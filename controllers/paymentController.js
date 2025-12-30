const db = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op, literal } = require('sequelize');
const { logger } = require('../utils/logger');

module.exports = {
  async getAllPayments(req, res, next) {
    try {
      const { page = 1, limit = 10, search = '', status, startDate, endDate, batchId } = req.query;
      const offset = (page - 1) * limit;

      // Build where conditions dynamically
      const wherePayment = {};
      if (status) wherePayment.status = status;
      if (startDate && endDate) {
        wherePayment.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
      }

      const whereParticipant = {};
      if (batchId) whereParticipant.batchId = batchId;

      const { count, rows } = await db.payment.findAndCountAll({
        where: wherePayment,
        include: [{
          model: db.batchparticipant,
          as: 'participant',
          where: whereParticipant,
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

  async getPaymentsByBatch(req, res, next) {
    try {
      const { batchId } = req.params;
      const { page = 1, limit = 10, search = '' } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows } = await db.payment.findAndCountAll({
        include: [{
          model: db.batchparticipant,
          as: 'participant',
          where: { batchId: batchId }, // Filter berdasarkan batchId
          include: [
            {
              model: db.user,
              as: 'user',
              where: search ? { name: { [Op.like]: `%${search}%` } } : {},
              attributes: ['name', 'email'],
              required: true
            }
          ],
          required: true
        }],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        status: true, message: `Berhasil mengambil pembayaran untuk batch ${batchId}.`, data: rows, totalItems: count, totalPages: Math.ceil(count / limit), currentPage: parseInt(page, 10)
      });
    } catch (error) {
      next(error);
    }
  },

  async getPaymentById(req, res, next) {
    try {
      const { id } = req.params;
      const payment = await db.payment.findByPk(id, {
        include: [{
          model: db.batchparticipant,
          as: 'participant',
          include: [
            { model: db.user, as: 'user', attributes: ['name', 'email'] },
            { model: db.batch, as: 'batch', attributes: ['namaBatch', 'price'] }
          ]
        }]
      });

      if (!payment) {
        return res.status(404).json({ status: false, message: 'Payment not found' });
      }

      res.status(200).json({
        status: true,
        message: 'Detail pembayaran berhasil diambil.',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  },

  async getPaymentsByUser(req, res, next) {
    try {
      const { userId } = req.params;
      // Authorization check: Admin atau user yang bersangkutan
      if (req.user.role !== 'admin' && req.user.uid !== userId) {
         return res.status(403).json({ status: false, message: 'Forbidden: Anda tidak diizinkan mengakses data ini.' });
      }

      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows } = await db.payment.findAndCountAll({
        include: [{
          model: db.batchparticipant,
          as: 'participant',
          where: { userId: userId },
          include: [
             { model: db.batch, as: 'batch', attributes: ['namaBatch', 'price', 'tanggalMulai', 'tanggalSelesai'] }
          ],
          required: true
        }],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        status: true,
        message: 'Berhasil mengambil riwayat pembayaran user.',
        data: rows,
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page, 10)
      });
    } catch (error) {
      next(error);
    }
  },

  async createManualPayment(req, res, next) {
    try {
      const { userId, batchId, amount, status, method } = req.body;

      // 1. Validasi input
      if (!userId || !batchId || !amount || !status || !method) {
        return res.status(400).json({
          status: false,
          message: 'userId, batchId, amount, status, dan method wajib diisi.'
        });
      }

      // 2. Cek apakah peserta sudah terdaftar di batch
      let participant = await db.batchparticipant.findOne({ where: { userId, batchId } });

      // 3. Jika peserta belum ada, daftarkan dulu
      if (!participant) {
        const batch = await db.batch.findByPk(batchId);
        if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });

        participant = await db.batchparticipant.create({
          id: uuidv4(),
          batchId,
          userId,
        }, { user: req.user });
      }

      // 4. Cek apakah sudah ada pembayaran, jika ada, update. Jika tidak, buat baru.
      // Logika ini mencegah duplikasi pembayaran jika joinBatch sudah dipanggil sebelumnya.
      const [payment, isCreated] = await db.payment.findOrCreate({
        where: { participantId: participant.id },
        defaults: {
          id: uuidv4(),
          participantId: participant.id,
          amount,
          status,
          method,
          paid_at: status === 'paid' ? new Date() : null,
        },
        user: req.user
      });

      if (!isCreated) {
        // Jika pembayaran sudah ada, update saja
        await payment.update({
          amount,
          status,
          method,
          paid_at: status === 'paid' ? new Date() : (status === 'pending' ? null : payment.paid_at),
        }, { user: req.user });
      }

      res.status(isCreated ? 201 : 200).json({
        status: true,
        message: `Pembayaran manual berhasil ${isCreated ? 'dibuat' : 'diperbarui'}.`,
        data: payment
      });

      /*
      // --- Kode Lama yang berpotensi duplikat ---
      const newPayment = await db.payment.create({
        id: uuidv4(),
        participantId,
        amount,
        status,
        method,
        paid_at: status === 'paid' ? new Date() : null,
      }, { user: req.user }); // Melewatkan user untuk logging hook

      res.status(201).json({ status: true, message: 'Pembayaran manual berhasil ditambahkan.', data: newPayment });
      */
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

  async deletePayment(req, res, next) {
    try {
      const { id } = req.params;
      const payment = await db.payment.findByPk(id);
      
      if (!payment) {
        return res.status(404).json({ status: false, message: 'Payment not found' });
      }

      await payment.destroy({ user: req.user });

      res.status(200).json({
        status: true,
        message: 'Pembayaran berhasil dihapus.'
      });
    } catch (error) {
      next(error);
    }
  },
};
