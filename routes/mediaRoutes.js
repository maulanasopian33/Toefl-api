// routes/mediaRoutes.js

const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const uploadMiddleware = require('../middlewares/uploadMiddleware');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// CREATE: Mengunggah file media baru. Hanya untuk admin.
router.post('/upload', checkAuth, checkPermission('media.upload'), uploadMiddleware.single('media'), mediaController.uploadFile);

// READ: Mengambil semua media dengan paginasi dan pencarian. Untuk pengguna terotentikasi.
router.get('/', checkAuth, checkPermission('media.read'), mediaController.getAllMedia);

// DELETE: Menghapus file media berdasarkan ID. Hanya untuk admin.
router.delete('/:id', checkAuth, checkPermission('media.delete'), mediaController.deleteMedia);

module.exports = router;