const axios = require('axios');
const { logger } = require('../utils/logger');

// Konfigurasi URL Service Python dan URL Callback aplikasi Node ini
// Sebaiknya dipindahkan ke process.env pada production
const PYTHON_SERVICE_URL = process.env.PYTHON_PDF_SERVICE_URL || 'http://127.0.0.1:8000/generate';
const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL || 'http://localhost:5000/callback';

/**
 * Memformat data tunggal menjadi struktur yang diminta service Python
 * @param {Object} data - Data sertifikat
 * @returns {Object} Payload siap kirim
 */
const formatPayload = (input) => {
  // Cek apakah input sudah memiliki properti 'data' untuk menghindari double nesting
  const data = (input && input.data) ? input.data : input;

  return {
    data: data,
    callback_url: APP_CALLBACK_URL
  };
};

/**
 * Mengirim permintaan generate PDF ke service Python
 * @param {Object|Array} inputData - Data sertifikat (bisa object tunggal atau array)
 * @returns {Promise} Axios response
 */
const generateCertificatePdf = async (inputData) => {
  try {
    let payload;

    // Cek apakah input adalah array (Bulk Request) atau Object (Single Request)
    if (Array.isArray(inputData)) {
      payload = inputData.map(item => formatPayload(item));
    } else {
      payload = formatPayload(inputData);
    }

    logger.info(`Sending PDF generation request to ${PYTHON_SERVICE_URL}`);
    
    // Kirim request ke Python Service
    const response = await axios.post(PYTHON_SERVICE_URL, payload, {
      headers: {
        'x-api-key': 'dev-secret'
      }
    });
    
    logger.info('PDF generation request sent successfully');
    return response.data;

  } catch (error) {
    logger.error('Error requesting PDF generation:', error.message);
    if (error.response) {
      logger.error('Service Response:', error.response.data);
    }
    throw error;
  }
};

module.exports = {
  generateCertificatePdf
};
