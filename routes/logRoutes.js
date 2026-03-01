const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// Endpoint untuk FE mengirim log aktivitas user ke database
router.post('/audit', logController.createAuditLog);

// Admin only: Melihat audit log dari database (aktivitas mutasi data)
router.get('/', checkAuth, checkPermission('system.app'), logController.getAuditLogs);

// Admin only: Melihat daftar file log sistem (file-based)
router.get('/system', checkAuth, checkPermission('system.app'), logController.listSystemLogs);

// Admin only: Membaca isi file log sistem tertentu (?lines=100)
router.get('/system/:filename', checkAuth, checkPermission('system.app'), logController.getSystemLogContent);

module.exports = router;