const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

// Secure all analytics routes with Admin/SuperAdmin access
router.use(checkAuth);
router.use(checkRole(['superadmin', 'admin']));

router.get('/participant-results', analyticsController.getParticipantResults);
router.get('/answer-details', analyticsController.getAnswerDetails);
router.get('/question-quality', analyticsController.getQuestionQuality);
router.get('/option-distribution', analyticsController.getOptionDistribution);
router.get('/participant-progress', analyticsController.getParticipantProgress);
router.get('/batch-statistics', analyticsController.getBatchStatistics);
router.get('/diagnostic-report', analyticsController.getDiagnosticReport);

module.exports = router;
