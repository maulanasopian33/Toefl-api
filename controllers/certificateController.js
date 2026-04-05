'use strict';

const db                  = require('../models');
const { Op }              = require('sequelize');
const fs                  = require('fs');
const path                = require('path');
const { logger }          = require('../utils/logger');
const storageUtil         = require('../utils/storage');
const { getCache, setCache, deleteCache } = require('../services/cache.service');
const certService         = require('../services/certificateService');

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
    const { id }    = req.params;
    const userId    = req.user?.uid;

    const certificate = await db.certificate.findByPk(id);

    if (!certificate) {
      return res.status(404).json({
        status  : false,
        message : 'Sertifikat tidak ditemukan.'
      });
    }

    // Pastikan hanya pemilik atau admin yang bisa download
    if (certificate.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        status  : false,
        message : 'Akses ditolak.'
      });
    }

    if (!certificate.pdfUrl) {
      return res.status(404).json({
        status  : false,
        message : 'File PDF belum tersedia.'
      });
    }

    // Resolve absolute path dari pdfUrl (relative path dari storage)
    const relativePath = certificate.pdfUrl.startsWith('/')
      ? certificate.pdfUrl.slice(1)
      : certificate.pdfUrl;

    const absolutePath = storageUtil.resolvePath(relativePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        status  : false,
        message : 'File PDF tidak ditemukan di server.'
      });
    }

    const fileName = `sertifikat-${certificate.certificateNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(absolutePath).pipe(res);
  } catch (error) {
    logger.error('[CertController] downloadCertificate error:', error);
    next(error);
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
        const relativePath = certificate.pdfUrl.startsWith('/')
          ? certificate.pdfUrl.slice(1)
          : certificate.pdfUrl;
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