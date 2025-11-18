const express = require('express');
const router = express.Router();
const adminStatsController = require('../controllers/adminStatsController');
// jika butuh auth middleware, bisa tambahkan disini
// const { authAdmin } = require('../middleware/authMiddleware');

router.get('/stats', /*authAdmin,*/ adminStatsController.getStats);
router.get('/financial-recap', /*authAdmin,*/ adminStatsController.getFinancialRecap);

module.exports = router;
