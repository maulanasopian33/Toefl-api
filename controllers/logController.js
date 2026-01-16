const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { logger } = require('../utils/logger');

/**
 * Mengambil log berdasarkan tanggal.
 * Membaca file log baris per baris dan mengonversinya menjadi array JSON.
 */
exports.getLogsByDate = async (req, res, next) => {
  try {
    // Ambil tanggal dari query, atau gunakan tanggal hari ini jika tidak ada
    const { date: queryDate, level: filterLevel, search: filterSearch } = req.query;
    const date = queryDate || new Date().toISOString().split('T')[0];
    // Validasi format tanggal YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        status: false,
        message: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.'
      });
    }

    const logDir = path.join(__dirname, '..', 'logs');
    const fileName = `${date}-application.log`;
    const filePath = path.join(logDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: false,
        message: `File log untuk tanggal ${date} tidak ditemukan.`,
        data: []
      });
    }

    const logs = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (line) {
        try {
          const logObject = JSON.parse(line);

          // Terapkan filter jika ada
          const levelMatch = !filterLevel || logObject.level === filterLevel;
          
          const searchMatch = !filterSearch || 
            (logObject.message && typeof logObject.message === 'string' && logObject.message.toLowerCase().includes(filterSearch.toLowerCase()));

          if (levelMatch && searchMatch) {
            logs.push(logObject);
          }
        } catch (parseError) {
          // Jika ada baris yang bukan JSON valid (jarang terjadi dengan winston),
          // kita bisa mencatatnya atau mengabaikannya. Di sini kita abaikan.
          if (filterSearch && !filterLevel && line.toLowerCase().includes(filterSearch.toLowerCase())) {
             // Untuk kasus log non-JSON, coba cari sebagai teks biasa
             logs.push({ level: 'unknown', message: line });
          }
          console.error('Gagal mem-parsing baris log:', line, parseError);
        }
      }
    }

    res.status(200).json({ status: true, message: `Log untuk tanggal ${date} berhasil diambil.`, data: logs });
  } catch (error) {
    next(error);
  }
};

/**
 * Menyimpan log yang dikirim dari Frontend.
 * Route: POST /logs/client
 */
exports.saveClientLog = async (req, res, next) => {
  try {
    const { level = 'info', message, metadata = {} } = req.body;

    if (!message) {
      return res.status(400).json({ status: false, message: 'Log message is required.' });
    }

    // Capture User Info if available from middleware
    const userId = req.user ? req.user.uid : 'anonymous';
    
    // Log to winston using the existing application log transport
    logger.log({
      level: level,
      message: message,
      source: 'frontend',
      userId: userId,
      ...metadata,
      timestamp: new Date()
    });

    res.status(201).json({ status: true, message: 'Client log saved successfully.' });
  } catch (error) {
    next(error);
  }
};
