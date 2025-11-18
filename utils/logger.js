const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logDir = 'logs';

// Buat direktori log jika belum ada
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Transport untuk log aplikasi (JSON)
const appLogTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, '%DATE%-application.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true, // Arsipkan log lama dalam format .gz
  maxSize: '20m',      // Ukuran maksimal file log sebelum rotasi
  maxFiles: '14d'      // Simpan log selama 14 hari
});
// Transport untuk log HTTP (teks biasa dari morgan)
const httpLogTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, '%DATE%-http.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});
const logger = winston.createLogger({
  level: 'info',
  // Format utama untuk file log (JSON)
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Tampilkan log di konsol untuk development dengan format sederhana
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Simpan log ke file dengan rotasi harian
    appLogTransport
  ]
});

// Logger khusus untuk HTTP requests dari Morgan
const httpLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => `${info.timestamp} ${info.message}`)
  ),
  transports: [httpLogTransport]
});

// Buat stream yang akan digunakan oleh morgan
httpLogger.stream = {
  write: (message) => {
    // Menghilangkan baris baru di akhir yang ditambahkan morgan
    httpLogger.info(message.trim());
  }
};

module.exports = {
  logger,
  httpLogger
};