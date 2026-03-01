const db = require('../models');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { sequelize } = require('../models'); // Import sequelize instance
const { generateInvoiceNumber } = require('../utils/invoiceGenerator');

module.exports = {
  async joinBatch(req, res, next) {
    const t = await sequelize.transaction(); // Start a transaction
    try {
      const userId = req.user.uid; // Ambil userId dari req.user (token)
      const { batchId } = req.body;

      // Cek apakah batch ada
      const batch = await db.batch.findByPk(batchId, { transaction: t });
      if (!batch) {
        await t.rollback();
        return res.status(404).json({ status: false, message: 'Batch not found' });
      }

      const now = new Date();

      // 1. Cek status batch (Harus 'OPEN' atau 'RUNNING' tergantung kebijakan, tapi biasanya 'OPEN' untuk pendaftaran)
      // User meminta: "peserta hanya bisa join ke batch saat masa pendaftaran dan batch sedang aktif berjalan"
      // Kita asumsikan 'OPEN' adalah saat pendaftaran dibuka.
      if (batch.status !== 'OPEN' && batch.status !== 'RUNNING') {
        await t.rollback();
        return res.status(400).json({ 
          status: false, 
          message: `Pendaftaran tidak diizinkan. Status batch saat ini: ${batch.status}` 
        });
      }

      // 2. Cek masa pendaftaran (registration_open_at & registration_close_at)
      if (batch.registration_open_at && now < new Date(batch.registration_open_at)) {
        await t.rollback();
        return res.status(400).json({ 
          status: false, 
          message: 'Pendaftaran belum dibuka.' 
        });
      }

      if (batch.registration_close_at && now > new Date(batch.registration_close_at)) {
        await t.rollback();
        return res.status(400).json({ 
          status: false, 
          message: 'Masa pendaftaran telah berakhir.' 
        });
      }
      
      // Cek ketersediaan kursi (jika dibatasi)
      if (batch.max_participants !== null) {
        const currentCount = await db.batchparticipant.count({
          where: { batchId },
          transaction: t
        });

        if (currentCount >= batch.max_participants) {
          await t.rollback();
          return res.status(400).json({ status: false, message: 'Batch is full. Maximum participants reached.' });
        }
      }

      // Validasi harga batch
      if (batch.price <= 0) {
        await t.rollback();
        logger.error(`Invalid batch price: ${batch.price} for batch ID `);
        return res.status(500).json({ status: false, message: 'Invalid batch configuration.' });
      }

      // Cek apakah user sudah join
      const existing = await db.batchparticipant.findOne({ where: { userId, batchId } , transaction: t});
      if (existing) {
         await t.rollback();
         return res.status(400).json({ status: false, message: 'Already joined this batch' });
      }

      // 4. Buat participant (Default status 'pending' unless auto-paid)
      const participant = await db.batchparticipant.create({
        id: uuidv4(),
        batchId,
        userId,
        status: batch.is_auto_paid ? 'active' : 'pending' // Asumsi ada field status di participant
      }, { user: req.user, transaction: t });

      // 5. Cek apakah sudah ada pembayaran untuk participant ini
      let payment = await db.payment.findOne({ where: { participantId: participant.id }, transaction: t });

      if (!payment) {
        const newInvoiceNumber = await generateInvoiceNumber();

        // Jika belum ada, buat pembayaran baru
        // Jika is_auto_paid = true, status langsung 'paid'
        payment = await db.payment.create({
          id: uuidv4(),
          invoiceNumber: newInvoiceNumber,
          participantId: participant.id,
          amount: batch.price,
          status: batch.is_auto_paid ? 'paid' : 'pending',
          method: batch.is_auto_paid ? 'auto' : 'manual',
          paidAt: batch.is_auto_paid ? new Date() : null
        }, { transaction: t });
      } else {
        // Jika sudah ada, kirim pesan bahwa pembayaran sudah ada
        await t.rollback();
        return res.status(400).json({
          status: false,
          message: 'Payment already exists for this batch. Contact admin for assistance.',
        });
      }

      await t.commit(); // Commit the transaction

      return res.status(201).json({
        status: true,
        message: 'Joined batch successfully',
        data: { participant, payment }
      });
    } catch (error) {
      await t.rollback(); // Rollback transaction on error
      next(error);
    }
  },

  async getParticipants(req, res, next) {
    try {
      const participants = await db.batchparticipant.findAll({
        include: [
          { model: db.payment, as: 'payments' },
          { model: db.batch, as: 'batch' },
          { model: db.user, as: 'user' }
        ],
      });
      res.json({
        status: true,
        message: 'Get participants successfully',
        data: participants
      });
    } catch (error) {
      next(error);
    }
  },

  async removeParticipant(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const { id } = req.params; // ID participant

      // 1. Cari participant
      const participant = await db.batchparticipant.findByPk(id, { transaction: t });
      if (!participant) {
        await t.rollback();
        return res.status(404).json({ status: false, message: 'Participant tidak ditemukan.' });
      }

      // 2. Hapus data terkait (seperti pembayaran yang masih pending)
      // Jika pembayaran sudah 'paid', mungkin ingin divalidasi dulu atau dibiarkan sebagai riwayat?
      // Untuk keamanan pendaftaran, kita hapus pembayarannya juga.
      await db.payment.destroy({
        where: { participantId: id },
        transaction: t
      });

      // 3. Hapus participant
      await participant.destroy({ transaction: t });

      await t.commit();
      res.json({
        status: true,
        message: 'Peserta berhasil dihapus dari batch.'
      });
    } catch (error) {
      if (t) await t.rollback();
      next(error);
    }
  }
};
