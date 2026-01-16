const db = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op, literal } = require('sequelize');
const { logger } = require('../utils/logger');
const { generateInvoiceNumber } = require('../utils/invoiceGenerator');
const storageUtil = require('../utils/storage');

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

            { model: db.batch, as: 'batch', attributes: ['name'] }
          ],
          required: true
        },
        {
          model: db.paymentproof,
          as: 'proofs'
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
        },
        {
          model: db.paymentproof,
          as: 'proofs'
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
            { model: db.batch, as: 'batch', attributes: ['name', 'price'] }
          ]
        },
        {
          model: db.paymentproof,
          as: 'proofs'
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
      
      // Authorization check: User dengan permission 'payment.view_all' ATAU user yang bersangkutan
      // req.user.permissions diisi oleh middleware rbacMiddleware
      const canViewAll = req.user.permissions && req.user.permissions.includes('payment.view_all');
      const isOwner = req.user.uid === userId;

      if (!canViewAll && !isOwner) {
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
             { model: db.batch, as: 'batch', attributes: ['name', 'price', 'start_date', 'end_date'] }
          ],
          required: true
        },
        {
          model: db.paymentproof,
          as: 'proofs'
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

      // Generate nomor invoice baru (hanya dipakai jika create baru)
      const newInvoiceNumber = await generateInvoiceNumber();
      // 4. Cek apakah sudah ada pembayaran, jika ada, update. Jika tidak, buat baru.
      // Logika ini mencegah duplikasi pembayaran jika joinBatch sudah dipanggil sebelumnya.
      const [payment, isCreated] = await db.payment.findOrCreate({
        where: { participantId: participant.id },
        defaults: {
          id: uuidv4(),
          invoiceNumber: newInvoiceNumber,
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
        const updateData = {
          amount,
          status,
          method,
          paid_at: status === 'paid' ? new Date() : (status === 'pending' ? null : payment.paid_at),
        };

        // Jika data lama belum punya invoiceNumber (null), isi dengan yang baru digenerate
        if (!payment.invoiceNumber) {
          updateData.invoiceNumber = newInvoiceNumber;
        }

        await payment.update(updateData, { user: req.user });
      }

      res.status(isCreated ? 201 : 200).json({
        status: true,
        message: `Pembayaran manual berhasil ${isCreated ? 'dibuat' : 'diperbarui'}.`,
        data: payment
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

  async addPaymentProof(req, res, next) {
    try {
      const { id } = req.params; // paymentId
      let { imageUrl } = req.body; // Bisa dari body jika kirim URL string

      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
      }

      if (!imageUrl) {
        return res.status(400).json({ status: false, message: 'Image URL atau file wajib diisi.' });
      }

      const payment = await db.payment.findByPk(id);
      if (!payment) {
        return res.status(404).json({ status: false, message: 'Payment not found' });
      }

      const proof = await db.paymentproof.create({
        id: uuidv4(),
        paymentId: id,
        imageUrl: imageUrl,
        uploadedAt: new Date()
      });

      res.status(201).json({
        status: true,
        message: 'Bukti pembayaran berhasil ditambahkan.',
        data: proof
      });
    } catch (error) {
      next(error);
    }
  },

  async deletePaymentProof(req, res, next) {
    try {
      const { proofId } = req.params;
      const proof = await db.paymentproof.findByPk(proofId);

      if (!proof) {
        return res.status(404).json({ status: false, message: 'Bukti pembayaran tidak ditemukan.' });
      }

      await proof.destroy();

      res.status(200).json({
        status: true,
        message: 'Bukti pembayaran berhasil dihapus.'
      });
    } catch (error) {
      next(error);
    }
  },
};
