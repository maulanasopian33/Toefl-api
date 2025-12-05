const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

// POST /results/calculate
router.post('/calculate', resultController.calculateResult);

// GET /results/:batchId - Mendapatkan hasil semua peserta per batch (hanya admin)
router.get('/:batchId', checkAuth, checkRole(['admin']), resultController.getResultsByBatch);
router.get('/detail/:resultId', resultController.getResultById);
// GET /results/user/:userId/batch/:batchId - Mendapatkan hasil spesifik user per batch (hanya admin)
router.get('/user/:userId/batch/:batchId', checkAuth, checkRole(['admin']), resultController.getResultsByUserAndBatch);
// GET /results/answers/:attemptId - Mendapatkan detail jawaban per percobaan tes (hanya admin)
router.get('/answers/:attemptId', checkAuth, checkRole(['admin']), resultController.getAnswersByAttemptId);


module.exports = router;
