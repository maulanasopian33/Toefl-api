const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { checkAuth } = require('../middleware/authMiddleware');
const { checkRole } = require('../middleware/rbacMiddleware');

router.use(checkAuth);
router.use(checkRole(['admin'], 'system.app')); // Only admins can see reports

router.get('/exam', reportController.getExamReport);

module.exports = router;
