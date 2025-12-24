const db = require('../models');
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
      
      // Tentukan lokasi simpan (misal: public/storage/certificates)
      const fileName = `${certificateNumber}.pdf`;
      const storageDir = path.join(__dirname, '../public/storage/certificates');
      
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      const savePath = path.join(storageDir, fileName);
      const publicPdfUrl = `/storage/certificates/${fileName}`;

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