const db = require('../models');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async updatePaymentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, method, payment_proof } = req.body;

      const payment = await db.payment.findByPk(id);
      if (!payment) return res.status(404).json({ status: false, message: 'Payment not found' });

      payment.status = status || payment.status;
      payment.method = method || payment.method;
      payment.payment_proof = payment_proof || payment.payment_proof;
      if (status === 'paid') payment.paid_at = new Date();

      await payment.save();

      res.json({
        status: true,
        message: 'Payment status updated successfully',
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  },
};
