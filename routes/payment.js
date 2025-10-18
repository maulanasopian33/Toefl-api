const express = require('express');
const router = express.Router();
const controller = require('../controllers/paymentController');

router.put('/:id/status', controller.updatePaymentStatus);

module.exports = router;
