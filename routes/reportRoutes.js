const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

router.use(checkAuth);
router.use(checkRole(['admin'], 'system.app')); // Only admins can see reports

router.get('/exam', reportController.getExamReport);
router.get('/participant', reportController.getParticipantReport);

// Exports
router.get('/exam/export', reportController.exportExamReportCSV);
router.get('/participant/export', reportController.exportParticipantReportCSV);
router.get('/finance/export', reportController.exportFinancialReportCSV);

module.exports = router;
