// middlewares/uploadMiddleware.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storageUtil = require('../utils/storage');

// Konfigurasi penyimpanan Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Pastikan direktori uploads ada. 
    // Menggunakan fungsi dinamis agar variable environment terbaca dengan benar saat runtime.
    const uploadDir = storageUtil.ensureDir('uploads');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Buat nama file yang unik untuk menghindari konflik
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filter untuk hanya menerima file gambar dan audio
const fileFilter = (req, file, cb) => {
  // Validasi berdasarkan ekstensi file
  const allowedExt = /^\.(jpeg|jpg|png|gif|mp3|wav|m4a)$/;
  const extname = allowedExt.test(path.extname(file.originalname).toLowerCase());

  // Validasi berdasarkan MIME type
  const allowedMimeTypes = /image\/jpeg|image\/png|image\/gif|audio\/mpeg|audio\/wav|audio\/mp4|audio\/x-m4a/;
  const mimetype = allowedMimeTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Error: Tipe file tidak diizinkan! Hanya gambar dan audio.'));
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 10 } // Batas ukuran file 10MB
});

module.exports = upload;