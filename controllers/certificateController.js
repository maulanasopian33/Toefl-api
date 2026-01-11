const db = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');
const { generateCertificatePdf } = require('../services/pdfService');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Menangani Callback dari Service Python
 */
exports.handleCallback = async (req, res) => {
  try {
    const { original_data, result, status, timestamp } = req.body;

    logger.info('PDF Service Callback received:', { status, timestamp });

    if (status === 'success') {
      const certificateNumber = original_data.certificate_number;
      const downloadUrl = result.download_url;

      logger.info(`Processing Certificate: ${certificateNumber}`);

      // 1. Download PDF dari Python Service ke Local Storage Node.js
      const pythonBaseUrl = process.env.PYTHON_SERVICE_BASE_URL || 'http://127.0.0.1:8000';
      const fileUrl = downloadUrl.startsWith('http') ? downloadUrl : `${pythonBaseUrl}${downloadUrl}`;
      
      // === CDN storage config (from env) ===
      const CDN_STORAGE_DIR = process.env.CDN_STORAGE_DIR || path.join(__dirname, '../public'); // fallback lama
      const CDN_CERT_SUBDIR = process.env.CDN_CERT_SUBDIR || 'storage/certificates';           // fallback lama
      const CDN_BASE_URL = (process.env.CDN_BASE_URL || '').replace(/\/+$/, '');              // trim trailing "/"
      const MKDIR_RECURSIVE = (process.env.CDN_MKDIR_RECURSIVE || 'true').toLowerCase() === 'true';

      // Nama file
      const fileName = `${certificateNumber}.pdf`;

      // Folder tujuan di filesystem
      const storageDir = path.resolve(path.join(CDN_STORAGE_DIR, CDN_CERT_SUBDIR));
      if (MKDIR_RECURSIVE && !fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      // Safety: pastikan file benar-benar ditulis di dalam storageDir
      const savePath = path.resolve(path.join(storageDir, fileName));
      if (!savePath.startsWith(storageDir + path.sep)) {
        throw new Error('Invalid savePath (path traversal detected)');
      }

      // URL publik yang disimpan ke DB
      let publicPdfUrl;
      if (CDN_BASE_URL) {
        // hasil: https://cdn.lbaiuqi.com/sertifikat/xxx.pdf
        publicPdfUrl = `${CDN_BASE_URL}/${CDN_CERT_SUBDIR.replace(/^\/+/, '').replace(/\/+$/, '')}/${encodeURIComponent(fileName)}`;
      } else {
        // fallback: relative url (kalau kamu masih serve dari app)
        publicPdfUrl = `/${CDN_CERT_SUBDIR.replace(/^\/+/, '').replace(/\/+$/, '')}/${encodeURIComponent(fileName)}`;
      }


      // Stream download file
      const response = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(savePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      logger.info(`PDF downloaded and saved to: ${savePath}`);

      // 2. Simpan Data ke Database
      await db.certificate.upsert({
        certificateNumber: certificateNumber,
        name: original_data.name,
        event: original_data.event,
        date: original_data.date,
        score: original_data.score,
        qrToken: original_data.qr_token,
        verifyUrl: original_data.verify_url,
        pdfUrl: publicPdfUrl,
        userId: original_data.user_id || null 
      });

      logger.info(`Certificate data saved to DB for ${certificateNumber}`);

    } else {
      logger.warn('PDF Generation reported failure via callback', req.body);
    }

    res.status(200).json({ message: 'Callback processed' });
  } catch (error) {
    logger.error('Error processing callback:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Test Trigger Generate PDF
 */
exports.testGenerate = async (req, res) => {
  try {
    // Mengambil data dari body request client, atau gunakan dummy data jika kosong
    const dataToGenerate = req.body.data || req.body; 
    
    const serviceResponse = await generateCertificatePdf(dataToGenerate);
    res.json({ message: 'Request sent to Python Service', service_response: serviceResponse });
  } catch (error) {
    logger.error('Error requesting PDF generation:', error);
    res.status(500).json({ error: 'Failed to request PDF generation' });
  }
};

/**
 * Mengambil daftar sertifikat dengan filter dan pagination
 * GET /certificates
 */
exports.getCertificates = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', userId, event, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // Filter berdasarkan User ID (jika ada)
    if (userId) {
      whereClause.userId = userId;
    }

    // Filter berdasarkan Event
    if (event) {
      whereClause.event = { [Op.like]: `%${event}%` };
    }

    // Filter berdasarkan Rentang Tanggal
    if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.date = { [Op.gte]: startDate };
    }

    // Pencarian (Search) pada Nama atau Nomor Sertifikat
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { certificateNumber: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await db.certificate.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['createdAt', 'DESC']],
      include: [{ model: db.user, as: 'user', attributes: ['name', 'email'] }]
    });

    res.status(200).json({
      status: true,
      message: 'Daftar sertifikat berhasil diambil.',
      data: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10)
    });
  } catch (error) {
    logger.error('Error fetching certificates:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};