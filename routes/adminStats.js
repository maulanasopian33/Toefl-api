const express = require('express');
const router = express.Router();
const adminStatsController = require('../controllers/adminStatsController');
// jika butuh auth middleware, bisa tambahkan disini
// const { authAdmin } = require('../middleware/authMiddleware');

router.get('/stats', /*authAdmin,*/ adminStatsController.getStats);
router.get('/financial-recap', /*authAdmin,*/ adminStatsController.getFinancialRecap);

// New Endpoint for Candidates
const resultController = require('../controllers/resultController');
router.get('/results/candidates', resultController.getCandidates);

module.exports = router;
