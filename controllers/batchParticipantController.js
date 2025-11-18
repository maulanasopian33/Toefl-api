const db = require('../models');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');

module.exports = {
  async joinBatch(req, res, next) {
    try {
      const { userId, batchId } = req.body;

      // Cek apakah batch ada
      const batch = await db.batch.findByPk(batchId);
      if (!batch) return res.status(404).json({ status : false, message: 'Batch not found' });

      // Cek apakah user sudah join
      const existing = await db.batchParticipant.findOne({ where: { userId, batchId } });
      if (existing) return res.status(400).json({ status : false, message: 'Already joined this batch' });

      // Create participant
      const participant = await db.batchParticipant.create({
        id: uuidv4(),
        batchId,
        userId,
      }, { user: req.user });

      // Create payment otomatis
      const payment = await db.payment.create({
        id: uuidv4(),
        participantId: participant.id,
        amount: batch.price,
        status: 'pending',
        method: 'manual', // default, nanti bisa diupdate
      });

      return res.status(201).json({
        status : true,
        message : 'Joined batch successfully',
        data : { participant, payment }
     });
    } catch (error) {
      next(error);
    }
  },

  async getParticipants(req, res, next) {
    try {
      const participants = await db.batchParticipant.findAll({
        include: [
          { model: db.payment, as: 'payments' },
          { model: db.batch, as: 'batch' },
        ],
      });
      res.json({
        status : true,
        message : 'Get participants successfully',
        data : participants
      });
    } catch (error) {
      next(error);
    }
  },
};
