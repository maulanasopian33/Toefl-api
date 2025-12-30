const express = require('express');
const router = express.Router();
const controller = require('../controllers/paymentController');

const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

router.get('/', checkAuth, checkRole(['admin']), controller.getAllPayments);
router.get('/batch/:batchId', controller.getPaymentsByBatch); // Route baru
router.get('/user/:userId', checkAuth, controller.getPaymentsByUser); // Get payment by user
router.get('/:id', checkAuth, controller.getPaymentById); // Get detail payment
router.post('/', checkAuth, checkRole(['admin']), controller.createManualPayment);

router.put('/:id', checkAuth, checkRole(['admin']), controller.updatePayment); // Route baru untuk edit
router.patch('/:id/status', checkAuth, checkRole(['admin']), controller.updatePaymentStatus); // Route lama tetap ada jika masih digunakan
router.delete('/:id', checkAuth, checkRole(['admin']), controller.deletePayment); // Delete payment

module.exports = router;
