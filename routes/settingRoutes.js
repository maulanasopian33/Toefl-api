// routes/settingRoutes.js

const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// Rute untuk mendapatkan pengaturan (bisa diakses publik atau oleh user terotentikasi)
router.get('/', settingController.getSettings);

// Rute untuk memperbarui pengaturan (hanya admin)
router.put('/', checkAuth, checkPermission('setting.update'), settingController.updateSettings);

module.exports = router;