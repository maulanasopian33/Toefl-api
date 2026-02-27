const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// Public or User authenticated endpoint to send logs from FE
router.post('/audit', logController.createAuditLog);

// Admin only to view logs
router.get('/', checkAuth, checkPermission('system.app'), logController.getAuditLogs);

module.exports = router;