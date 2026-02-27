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

      // Buat participant
      const participant = await db.batchparticipant.create({
        id: uuidv4(),
        batchId,
        userId,
      }, { user: req.user, transaction: t });

      // Cek apakah sudah ada pembayaran untuk participant ini
      let payment = await db.payment.findOne({ where: { participantId: participant.id }, transaction: t });

      if (!payment) {
        const newInvoiceNumber = await generateInvoiceNumber();

        // Jika belum ada, buat pembayaran baru
        payment = await db.payment.create({
          id: uuidv4(),
          invoiceNumber: newInvoiceNumber,
          participantId: participant.id,
          amount: batch.price,
          status: 'pending',
          method: 'manual', // default, nanti bisa diupdate
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
};
