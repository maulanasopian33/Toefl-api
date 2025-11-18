const db = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op, literal } = require('sequelize');
const { logger } = require('../utils/logger');

module.exports = {
  async getAllPayments(req, res, next) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows } = await db.payment.findAndCountAll({
        include: [{
          model: db.batchParticipant,
          as: 'participant',
          include: [
            {
              model: db.user,
              as: 'user',
              where: search ? { name: { [Op.like]: `%${search}%` } } : {},
              attributes: ['name', 'email'],
              required: true
            },

            { model: db.batch, as: 'batch', attributes: ['namaBatch'] }
          ],
          required: true
        }],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        status: true,
        message: 'Berhasil mengambil daftar pembayaran.',
        data: rows,
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page, 10)
      });
    } catch (error) {
      next(error);
    }
  },
  async updatePaymentStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, method, payment_proof } = req.body;

      const payment = await db.payment.findByPk(id);
      if (!payment) return res.status(404).json({ status: false, message: 'Payment not found' });

      payment.status = status || payment.status;
      payment.method = method || payment.method;
      payment.payment_proof = payment_proof || payment.payment_proof;
      
      if (status) { // Hanya proses jika status ada di body request
        if (status === 'paid') {
          payment.paid_at = new Date();
        } else {
          payment.paid_at = null; // Reset tanggal pembayaran jika status bukan 'paid'
        }
      }

      await payment.save({ user: req.user });

      res.json({
        status: true,
        message: 'Payment status updated successfully',
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  },
  async updatePayment(req, res, next) {
    try {
      const { id } = req.params;
      const { amount, status, method, payment_proof } = req.body;

      const payment = await db.payment.findByPk(id);
      if (!payment) {
        return res.status(404).json({ status: false, message: 'Payment not found' });
      }

      // Update field jika ada di body request
      payment.amount = amount ?? payment.amount;
      payment.method = method ?? payment.method;
      payment.payment_proof = payment_proof ?? payment.payment_proof;

      if (status) {
        payment.status = status;
        payment.paid_at = status === 'paid' ? new Date() : null;
      }

      await payment.save({ user: req.user });

      res.json({
        status: true,
        message: 'Payment updated successfully',
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  },
};
