const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// Endpoint untuk FE menyimpan log (hanya butuh auth minimal)
router.post('/store', checkAuth, debugController.storeDebugLog);

// Endpoint untuk Admin melihat/menghapus log (butuh permission system.app)
router.get('/', checkAuth, checkPermission('system.app'), debugController.getDebugLogs);
router.post('/clear', checkAuth, checkPermission('system.app'), debugController.clearDebugLogs);

module.exports = router;
