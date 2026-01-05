const { batch, batchsession, user, sequelize, batchparticipant, payment } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

module.exports = {
  createBatch: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const {
        name,
        description,
        type,
        start_date,
        end_date,
        registration_open_at,
        registration_close_at,
        max_participants,
        min_participants,
        status,
        price,
        currency,
        duration_minutes,
        special_instructions,
        sessions // Expecting an array of session objects
      } = req.body;

      const idBatch = uuidv4();
      const createdBy = req.user ? req.user.uid : null;

      // 1. Create the Batch
      const newBatch = await batch.create({
        idBatch,
        name,
        description,
        type,
        start_date,
        end_date,
        registration_open_at,
        registration_close_at,
        max_participants,
        min_participants,
        status,
        price,
        currency,
        duration_minutes,
        special_instructions,
        created_by: createdBy
      }, { transaction });

      // 2. Create Sessions if provided
      if (sessions && Array.isArray(sessions) && sessions.length > 0) {
        const sessionData = sessions.map(session => ({
          ...session,
          batch_id: idBatch
        }));
        await batchsession.bulkCreate(sessionData, { transaction });
      }

      await transaction.commit();

      // Fetch the created batch with sessions to return
      const result = await batch.findByPk(idBatch, {
        include: [
          { model: batchsession, as: 'sessions' },
          { model: user, as: 'creator', attributes: ['uid', 'name', 'email'] }
        ]
      });

      return res.status(201).json({
        status: true,
        data: result
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating batch:', error);
      return res.status(500).json({
        status: false,
        message: 'Failed to create batch',
        error: error.message
      });
    }
  },

  getAllBatches: async (req, res) => {
    try {
      const { status, type } = req.query;
      const where = {};
      
      if (status) where.status = status;
      if (type) where.type = type;

      const batches = await batch.findAll({
        where,
        include: [
          { model: batchsession, as: 'sessions' },
          { model: user, as: 'creator', attributes: ['uid', 'name'] }
        ],
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        status: true,
        data: batches
      });
    } catch (error) {
      console.error('Error fetching batches:', error);
      return res.status(500).json({
        status: false,
        message: 'Failed to fetch batches',
        error: error.message
      });
    }
  },

  getBatchById: async (req, res) => {
    try {
      const { idBatch } = req.params;
      const data = await batch.findByPk(idBatch, {
        include: [
          { model: batchsession, as: 'sessions' },
          { model: user, as: 'creator', attributes: ['uid', 'name', 'email'] },
          { 
            model: batchparticipant, 
            as: "participants", 
            include: [
              { model: user, as: "user", attributes: ['name', 'email', 'picture'] },
              { model: payment, as: 'payments' }, // Tambahkan ini untuk menyertakan data pembayaran
            ] 
          }
        ]
      });

      if (!data) {
        return res.status(404).json({
          status: false,
          message: 'Batch not found'
        });
      }

      const responseData = data.toJSON();

      // Hitung total pembayaran berdasarkan status
      let totalPaid = 0;
      let totalPending = 0;
      let totalUnpaid = 0;

      let totalUserPaid = 0;
      let totalUserPending = 0;
      let totalUserUnpaid = 0;

      if (responseData.participants) {
        responseData.participants.forEach(participant => {
          let isParticipantPaid = false;
          let isParticipantPending = false;

          if (participant.payments) {
            participant.payments.forEach(p => {
              const amount = parseFloat(p.amount) || 0;
              if (p.status === 'paid') {
                totalPaid += amount;
                isParticipantPaid = true;
              } else if (p.status === 'pending') {
                totalPending += amount;
                isParticipantPending = true;
              } else if (p.status === 'failed') {
                totalUnpaid += amount;
              }
            });
          }

          if (isParticipantPaid) {
            totalUserPaid++;
          } else if (isParticipantPending) {
            totalUserPending++;
          } else {
            totalUserUnpaid++;
          }
        });
      }
      
      responseData.payments = {
        totalPaid,
        totalPending,
        totalUnpaid,
        totalUserPaid,
        totalUserPending,
        totalUserUnpaid
      }

      return res.status(200).json({
        status: true,
        data: responseData
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: 'Failed to fetch batch details',
        error: error.message
      });
    }
  },

  updateBatch: async (req, res) => {
    try {
      const { idBatch } = req.params;
      const updateData = req.body;

      // Prevent updating idBatch or created_by directly via this endpoint if needed
      delete updateData.idBatch;
      delete updateData.created_by;

      const [updated] = await batch.update(updateData, {
        where: { idBatch }
      });

      if (!updated) {
        return res.status(404).json({
          status: false,
          message: 'Batch not found or no changes made'
        });
      }

      const updatedBatch = await batch.findByPk(idBatch);
      return res.status(200).json({
        status: true,
        data: updatedBatch
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: 'Failed to update batch',
        error: error.message
      });
    }
  },

  deleteBatch: async (req, res) => {
    try {
      const { idBatch } = req.params;
      const deleted = await batch.destroy({
        where: { idBatch }
      });

      if (!deleted) {
        return res.status(404).json({
          status: false,
          message: 'Batch not found'
        });
      }

      return res.status(200).json({
        status: true,
        message: 'Batch deleted successfully'
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: 'Failed to delete batch',
        error: error.message
      });
    }
  }
};