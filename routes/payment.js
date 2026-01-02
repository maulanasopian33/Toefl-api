const express = require('express');
const router = express.Router();
const controller = require('../controllers/paymentController');
const paymentController = require('../controllers/paymentController');

const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

router.get('/', checkAuth, checkRole(['admin']), controller.getAllPayments);
router.get('/batch/:batchId', controller.getPaymentsByBatch); // Route baru
router.get('/user/:userId', checkAuth, controller.getPaymentsByUser); // Get payment by user
router.get('/:id', checkAuth, controller.getPaymentById); // Get detail payment
router.post('/', checkAuth, checkRole(['admin']), controller.createManualPayment);

router.put('/:id', checkAuth, checkRole(['admin']), controller.updatePayment); // Route baru untuk edit
router.patch('/:id/status', checkAuth, checkRole(['admin']), controller.updatePaymentStatus); // Route lama tetap ada jika masih digunakan
router.delete('/:id', checkAuth, checkRole(['admin']), controller.deletePayment); // Delete payment

// Endpoint untuk menambahkan bukti pembayaran ke transaksi tertentu
// POST /payments/:id/proof
router.post('/:id/proof', checkAuth, uploadMiddleware.single('image'), paymentController.addPaymentProof);

// Endpoint untuk menghapus bukti pembayaran spesifik
// DELETE /payments/proof/:proofId
router.delete('/proof/:proofId', /* auth.verifyToken, */ paymentController.deletePaymentProof);


module.exports = router;
