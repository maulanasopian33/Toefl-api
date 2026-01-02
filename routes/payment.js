const express = require('express');
const router = express.Router();
const controller = require('../controllers/paymentController');
const paymentController = require('../controllers/paymentController');

const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

router.get('/', checkAuth, checkPermission('payment.view_all'), controller.getAllPayments);
router.get('/batch/:batchId', checkAuth, checkPermission('payment.view_all'), controller.getPaymentsByBatch); // Route baru
router.get('/user/:userId', checkAuth, checkPermission(), controller.getPaymentsByUser); // Get payment by user (Permission dicek di controller)
router.get('/:id', checkAuth, controller.getPaymentById); // Get detail payment
router.post('/', checkAuth, checkPermission('payment.create'), controller.createManualPayment);

router.put('/:id', checkAuth, checkPermission('payment.update'), controller.updatePayment); // Route baru untuk edit
router.patch('/:id/status', checkAuth, checkPermission('payment.update'), controller.updatePaymentStatus); // Route lama tetap ada jika masih digunakan
router.delete('/:id', checkAuth, checkPermission('payment.update'), controller.deletePayment); // Delete payment

// Endpoint untuk menambahkan bukti pembayaran ke transaksi tertentu
// POST /payments/:id/proof
router.post('/:id/proof', checkAuth, uploadMiddleware.single('image'), paymentController.addPaymentProof);

// Endpoint untuk menghapus bukti pembayaran spesifik
// DELETE /payments/proof/:proofId
router.delete('/proof/:proofId', /* auth.verifyToken, */ paymentController.deletePaymentProof);


module.exports = router;
