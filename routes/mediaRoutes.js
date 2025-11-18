// routes/mediaRoutes.js

const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const uploadMiddleware = require('../middlewares/uploadMiddleware');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

// CREATE: Mengunggah file media baru. Hanya untuk admin.
router.post('/upload', checkAuth, checkRole(['admin']), uploadMiddleware.single('media'), mediaController.uploadFile);

// READ: Mengambil semua media dengan paginasi dan pencarian. Untuk pengguna terotentikasi.
router.get('/', checkAuth, mediaController.getAllMedia);

// DELETE: Menghapus file media berdasarkan ID. Hanya untuk admin.
router.delete('/:id', checkAuth, checkRole(['admin']), mediaController.deleteMedia);

module.exports = router;