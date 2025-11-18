const express = require('express');
const router = express.Router();
const controller = require('../controllers/paymentController');

const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

router.get('/', checkAuth, checkRole(['admin']), controller.getAllPayments);

router.put('/:id', checkAuth, checkRole(['admin']), controller.updatePayment); // Route baru untuk edit
router.patch('/:id/status', checkAuth, checkRole(['admin']), controller.updatePaymentStatus); // Route lama tetap ada jika masih digunakan

module.exports = router;
