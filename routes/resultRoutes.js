const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// POST /results/calculate
router.post('/calculate', resultController.calculateResult);

// GET /results/:batchId - Mendapatkan hasil semua peserta per batch (hanya admin)
router.get('/:batchId', checkAuth, checkPermission('result.view_all'), resultController.getResultsByBatch);
router.get('/detail/:resultId', resultController.getResultById);
// GET /results/user/:userId/batch/:batchId - Mendapatkan hasil spesifik user per batch (hanya admin)
router.get('/user/:userId/batch/:batchId', checkAuth, checkPermission('result.view_all'), resultController.getResultsByUserAndBatch);
// GET /results/answers/:attemptId - Mendapatkan detail jawaban per percobaan tes (hanya admin)
router.get('/answers/:attemptId', checkAuth, checkPermission('result.view_all'), resultController.getAnswersByAttemptId);

// POST /results/recalculate-batch - Hitung ulang semua skor dalam satu batch (admin only)
router.post('/recalculate-batch', checkAuth, checkPermission('result.view_all'), resultController.recalculateBatch);


module.exports = router;
