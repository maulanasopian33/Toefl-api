'use strict';

const db                  = require('../models');
const { Op }              = require('sequelize');
const fs                  = require('fs');
const path                = require('path');
const { logger }          = require('../utils/logger');
const storageUtil         = require('../utils/storage');
const { getCache, setCache, deleteCache } = require('../services/cache.service');
const certService         = require('../services/certificateService');
const archiver            = require('archiver');

const CERT_CACHE_KEY_ALL    = 'cert:list:all';
const CERT_CACHE_KEY_DETAIL = (id) => `cert:detail:${id}`;
const CACHE_TTL             = 300; // 5 menit

// =============================================================================
// GENERATE — Single Participant
// POST /certificates/generate/participant
// =============================================================================

/**
 * Generate sertifikat untuk satu peserta (manual oleh admin).
 * Body: { userResultId: number, templateFormatId?: number }
 */
exports.generateForParticipant = async (req, res, next) => {
  try {
    const { userResultId, templateFormatId } = req.body;

    if (!userResultId) {
      return res.status(400).json({
        status  : false,
        message : 'userResultId wajib diisi.'
      });
    }

    const { certificate, pdfUrl } = await certService.generateCertificate({
      userResultId     : parseInt(userResultId, 10),
      templateFormatId : templateFormatId ? parseInt(templateFormatId, 10) : null
    });

    // Invalidasi cache list
    await deleteCache(CERT_CACHE_KEY_ALL);

    res.status(200).json({
      status  : true,
      message : 'Sertifikat berhasil di-generate.',
      data    : {
        certificate,
        pdfUrl
      }
    });
  } catch (error) {
    logger.error('[CertController] generateForParticipant error:', error.message);
    res.status(500).json({
      status  : false,
      message : error.message || 'Gagal generate sertifikat.'
    });
  }
};

// =============================================================================
// GENERATE — All Participants in a Batch
// POST /certificates/generate/batch
// =============================================================================

/**
 * Generate sertifikat untuk seluruh peserta COMPLETED dalam satu batch.
 * Body: { batchId: string, templateFormatId?: number }
 */
exports.generateForBatch = async (req, res, next) => {
  try {
    const { batchId, templateFormatId } = req.body;

    if (!batchId) {
      return res.status(400).json({
        status  : false,
        message : 'batchId wajib diisi.'
      });
    }

    const outcomes = await certService.generateBatchCertificates({
      batchId,
      templateFormatId : templateFormatId ? parseInt(templateFormatId, 10) : null
    });

    // Invalidasi cache list
    await deleteCache(CERT_CACHE_KEY_ALL);

    const successCount = outcomes.filter(o => o.success).length;
    const failCount    = outcomes.filter(o => !o.success).length;

    res.status(200).json({
      status  : true,
      message : `Generate selesai. Berhasil: ${successCount}, Gagal: ${failCount}.`,
      data    : {
        summary : { successCount, failCount, total: outcomes.length },
        results : outcomes
      }
    });
  } catch (error) {
    logger.error('[CertController] generateForBatch error:', error.message);
    res.status(500).json({
      status  : false,
      message : error.message || 'Gagal generate sertifikat batch.'
    });
  }
};

// =============================================================================
// LIST — Semua Sertifikat (Admin)
// GET /certificates
// =============================================================================

/**
 * Mengambil daftar sertifikat dengan filter dan pagination.
 * Query: { page, limit, search, userId, batchId, startDate, endDate }
 */
exports.getCertificates = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 10,
      search = '',
      userId, batchId,
      startDate, endDate
    } = req.query;

    const offset      = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const whereClause = {};

    if (userId)  whereClause.userId  = userId;
    if (batchId) whereClause.batchId = batchId;

    if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.date = { [Op.gte]: startDate };
    }

    if (search) {
      whereClause[Op.or] = [
        { name              : { [Op.like]: `%${search}%` } },
        { certificateNumber : { [Op.like]: `%${search}%` } },
        { event             : { [Op.like]: `%${search}%` } }
      ];
    }

    // Deduplication: Only the latest certificate per user per batch
    whereClause.id = {
      [Op.in]: db.sequelize.literal(`(
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY userId, batchId 
            ORDER BY createdAt DESC
          ) as rn
          FROM certificates
        ) as ranked_certs WHERE rn = 1
      )`)
    };

    const { count, rows } = await db.certificate.findAndCountAll({
      where   : whereClause,
      limit   : parseInt(limit, 10),
      offset,
      order   : [['createdAt', 'DESC']],
      include : [
        { model: db.user, as: 'user', attributes: ['name', 'email'] }
      ]
    });

    res.status(200).json({
      status      : true,
      data        : rows,
      totalItems  : count,
      totalPages  : Math.ceil(count / parseInt(limit, 10)),
      currentPage : parseInt(page, 10)
    });
  } catch (error) {
    logger.error('[CertController] getCertificates error:', error);
    next(error);
  }
};

// =============================================================================
// VIEW — Sertifikat Milik User Sendiri
// GET /certificates/my/:userResultId
// =============================================================================

/**
 * User melihat sertifikat miliknya berdasarkan userResultId.
 */
exports.getCertificateByUserResult = async (req, res, next) => {
  try {
    const { userResultId } = req.params;
    const userId           = req.user?.uid;

    const certificate = await db.certificate.findOne({
      where: { userResultId: parseInt(userResultId, 10) }
    });

    if (!certificate) {
      return res.status(404).json({
        status  : false,
        message : 'Sertifikat belum tersedia. Hubungi admin untuk generate sertifikat.'
      });
    }

    // Pastikan hanya pemilik atau admin yang bisa akses
    if (certificate.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        status  : false,
        message : 'Akses ditolak.'
      });
    }

    res.status(200).json({
      status : true,
      data   : certificate
    });
  } catch (error) {
    logger.error('[CertController] getCertificateByUserResult error:', error);
    next(error);
  }
};

// =============================================================================
// VERIFY — Verifikasi Publik via QR Token
// GET /certificates/verify/:qrToken
// =============================================================================

/**
 * Public endpoint untuk verifikasi sertifikat via QR code.
 * Tidak memerlukan autentikasi.
 */
exports.verifyCertificate = async (req, res, next) => {
  try {
    const { qrToken } = req.params;

    const cacheKey = `cert:verify:${qrToken}`;
    const cached   = await getCache(cacheKey);
    if (cached) {
      return res.set('X-Cache', 'HIT').status(200).json(cached);
    }

    const certificate = await db.certificate.findOne({
      where   : { qrToken },
      include : [
        { model: db.user, as: 'user', attributes: ['name', 'email'] }
      ]
    });

    if (!certificate) {
      return res.status(404).json({
        status  : false,
        message : 'Sertifikat tidak ditemukan atau token tidak valid.',
        valid   : false
      });
    }

    const response = {
      status : true,
      valid  : true,
      data   : {
        certificateNumber : certificate.certificateNumber,
        name              : certificate.name,
        event             : certificate.event,
        date              : certificate.date,
        score             : certificate.score,
        verifyUrl         : certificate.verifyUrl,
        issuedAt          : certificate.createdAt
      }
    };

    // Cache verifikasi 30 menit
    await setCache(cacheKey, response, 1800);
    res.set('X-Cache', 'MISS').status(200).json(response);
  } catch (error) {
    logger.error('[CertController] verifyCertificate error:', error);
    next(error);
  }
};

// =============================================================================
// DOWNLOAD — Stream PDF ke response
// GET /certificates/download/:id
// =============================================================================

/**
 * Download file PDF sertifikat.
 */
exports.downloadCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    const userRole = req.user?.role;

    logger.info(`[CertController] Download requested for ID: ${id} by User: ${userId} (${userRole})`);

    // 1. Cari record sertifikat
    let certificate = await db.certificate.findByPk(id);
    
    // Fallback: Jika tidak ditemukan sebagai PK (mungkin integer?), coba cari di kolom lain atau casting?
    // Namun ID di model adalah UUID. Jika frontend kirim integer ID dari userresult?
    if (!certificate) {
      certificate = await db.certificate.findOne({ where: { userResultId: id } });
    }

    if (!certificate) {
      logger.warn(`[CertController] Certificate record not found for ID: ${id}`);
      return res.status(404).json({
        status: false,
        message: `Sertifikat dengan ID ${id} tidak ditemukan di database.`
      });
    }

    // 2. Otorisasi
    if (certificate.userId !== userId && userRole !== 'admin') {
      logger.warn(`[CertController] Unauthorized download attempt: User ${userId} tried to download Cert of User ${certificate.userId}`);
      return res.status(403).json({
        status: false,
        message: 'Akses ditolak. Anda hanya dapat mengunduh sertifikat milik sendiri.'
      });
    }

    // 3. Cek ketersediaan URL PDF di database
    if (!certificate.pdfUrl) {
      logger.warn(`[CertController] PDF URL is empty in database for Cert ID: ${id}`);
      return res.status(404).json({
        status: false,
        message: 'Data file PDF belum tersedia di database untuk sertifikat ini.'
      });
    }

    // 4. Resolve absolute path
    const relativePath = storageUtil.getRelativePath(certificate.pdfUrl);
    const absolutePath = storageUtil.resolvePath(relativePath);
    logger.info(`[CertController] Attempting to stream file: ${absolutePath}`);

    // 5. Cek fisik file di filesystem
    if (!fs.existsSync(absolutePath)) {
      logger.error(`[CertController] Physical PDF file not found at: ${absolutePath}`);
      return res.status(404).json({
        status: false,
        message: 'File PDF tidak ditemukan di server. Silakan hubungi admin untuk generate ulang.'
      });
    }

    const fileName = `sertifikat-${certificate.certificateNumber || 'download'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.on('error', (err) => {
      logger.error(`[CertController] Stream error: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({ status: false, message: 'Gagal membaca file sertifikat.' });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    logger.error('[CertController] downloadCertificate exception:', error.message);
    next(error);
  }
};

// =============================================================================
// DOWNLOAD ALL ZIP — Stream Multiple PDFs into a ZIP archive
// GET /certificates/download-all/zip
// =============================================================================

/**
 * Download semua sertifikat (berdasarkan filter) dalam bentuk ZIP.
 */
exports.downloadAllZip = async (req, res, next) => {
  try {
    const {
      search = '',
      userId, batchId,
      startDate, endDate
    } = req.query;

    const whereClause = {};
    if (userId)  whereClause.userId  = userId;
    if (batchId) whereClause.batchId = batchId;

    if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.date = { [Op.gte]: startDate };
    }

    if (search) {
      whereClause[Op.or] = [
        { name              : { [Op.like]: `%${search}%` } },
        { certificateNumber : { [Op.like]: `%${search}%` } },
        { event             : { [Op.like]: `%${search}%` } }
      ];
    }

    // Deduplication: Only the latest certificate per user per batch
    whereClause.id = {
      [Op.in]: db.sequelize.literal(`(
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY userId, batchId 
            ORDER BY createdAt DESC
          ) as rn
          FROM certificates
        ) as ranked_certs WHERE rn = 1
      )`)
    };

    // 1. Ambil list sertifikat
    const certificates = await db.certificate.findAll({
      where: whereClause,
      attributes: ['pdfUrl', 'certificateNumber', 'name']
    });

    if (certificates.length === 0) {
      return res.status(404).json({
        status: false,
        message: 'Tidak ada sertifikat ditemukan untuk kriteria ini.'
      });
    }

    // 2. Setup archiver
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    archive.on('error', (err) => {
      logger.error('[CertController] Archiver error:', err.message);
      throw err;
    });

    // 3. Set headers
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `certificates-${timestamp}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // 4. Pipe archive data to response
    archive.pipe(res);

    // 5. Tambahkan file ke archive
    let addedCount = 0;
    for (const cert of certificates) {
      if (!cert.pdfUrl) continue;

      const relativePath = storageUtil.getRelativePath(cert.pdfUrl);
      const absolutePath = storageUtil.resolvePath(relativePath);

      if (fs.existsSync(absolutePath)) {
        // Gunakan nama file yang deskriptif di dalam zip
        // Format: [Nama] - [NomorSertifikat].pdf
        const internalFileName = `${cert.name.replace(/[/\\?%*:|"<>]/g, '_')} - ${cert.certificateNumber}.pdf`;
        archive.file(absolutePath, { name: internalFileName });
        addedCount++;
      }
    }

    if (addedCount === 0) {
      // Jika tidak ada file fisik, kirim error (agak telat tapi aman)
      return res.status(404).json({ status: false, message: 'File fisik PDF tidak ditemukan untuk semua record.' });
    }

    // 6. Finalize
    await archive.finalize();
    logger.info(`[CertController] ZIP Bulk Download: ${addedCount} files zipped.`);

  } catch (error) {
    logger.error('[CertController] downloadAllZip exception:', error.message);
    if (!res.headersSent) {
      next(error);
    }
  }
};

// =============================================================================
// DELETE — Hapus Sertifikat (Admin)
// DELETE /certificates/:id
// =============================================================================

/**
 * Hapus record sertifikat dan file PDF-nya.
 */
exports.deleteCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const certificate = await db.certificate.findByPk(id);
    if (!certificate) {
      return res.status(404).json({
        status  : false,
        message : 'Sertifikat tidak ditemukan.'
      });
    }

    // Hapus file PDF dari storage jika ada
    if (certificate.pdfUrl) {
      try {
        const relativePath = storageUtil.getRelativePath(certificate.pdfUrl);
        const absolutePath = storageUtil.resolvePath(relativePath);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
          logger.info(`[CertController] Deleted PDF file: ${absolutePath}`);
        }
      } catch (fsErr) {
        logger.warn(`[CertController] Gagal hapus file PDF: ${fsErr.message}`);
      }
    }

    await certificate.destroy();

    // Invalidasi cache
    await Promise.all([
      deleteCache(CERT_CACHE_KEY_ALL),
      deleteCache(CERT_CACHE_KEY_DETAIL(id))
    ]);

    res.status(200).json({
      status  : true,
      message : 'Sertifikat berhasil dihapus.'
    });
  } catch (error) {
    logger.error('[CertController] deleteCertificate error:', error);
    next(error);
  }
};