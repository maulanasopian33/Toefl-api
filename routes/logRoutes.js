const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

router.get('/', checkAuth, checkPermission('system.view_logs'), logController.getLogsByDate);

module.exports = router;