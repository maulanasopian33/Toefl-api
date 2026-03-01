const { batch, batchsession, user, sequelize, batchparticipant, payment, section, group, question, detailuser } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');

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
        scoring_type,
        scoring_config,
        sessions // Expecting an array of session objects
      } = req.body;

      const idBatch = uuidv4();
      const createdBy = req.user ? req.user.uid : null;

      // 1. Create the Batch
      let finalScoringConfig = scoring_config;
      
      // Robust parsing if scoring_config is a string
      if (typeof finalScoringConfig === 'string') {
        try {
          finalScoringConfig = JSON.parse(finalScoringConfig);
        } catch (e) {
          finalScoringConfig = {};
        }
      }

      if (scoring_type === 'RAW' || (finalScoringConfig && finalScoringConfig.initialScore !== undefined)) {
        finalScoringConfig = {
          ...finalScoringConfig,
          initialScore: parseInt(finalScoringConfig?.initialScore) || 0
        };
      }

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
        scoring_type,
        scoring_config: finalScoringConfig,
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
      // Use separate query for creator to avoid collation issues
      const result = await batch.findByPk(idBatch, {
        include: [
          { model: batchsession, as: 'sessions' }
        ]
      });

      if (result) {
        const creator = await user.findByPk(result.created_by, {
          attributes: ['uid', 'name', 'email'],
          include: [{ model: detailuser, as: 'detailuser' }]
        });
        const responseData = result.toJSON();
        responseData.creator = creator;
        
        // Ensure scoring_config is an object
        if (typeof responseData.scoring_config === 'string') {
          try {
            responseData.scoring_config = JSON.parse(responseData.scoring_config);
          } catch (e) {
            responseData.scoring_config = {};
          }
        }
        
        return res.status(201).json({
          status: true,
          data: responseData
        });
      }

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

      // Step 1: Ambil data batch (serta sesi) tanpa JOIN ke tabel ‘user’ langsung
      // Ini menghindari error ‘Illegal mix of collations’ jika ada perbedaan kolasi
      const batchesData = await batch.findAll({
        where,
        include: [
          { model: batchsession, as: 'sessions' }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Jika data kosong, langsung kembalikan
      if (batchesData.length === 0) {
        return res.status(200).json({
          status: true,
          data: []
        });
      }

      // Ambil semua ID pembuat (created_by) secara unik
      const creatorIds = [...new Set(batchesData.map(b => b.created_by).filter(Boolean))];

      let creatorMap = {};
      if (creatorIds.length > 0) {
        const creators = await user.findAll({
          where: { uid: creatorIds },
          attributes: ['uid', 'name'],
          include: [{ model: detailuser, as: 'detailuser' }]
        });
        creators.forEach(c => {
          creatorMap[c.uid] = c.toJSON();
        });
      }

      // Gabungkan data creator kembali ke masing-masing batch
      const result = batchesData.map(b => {
        const item = b.toJSON();
        item.creator = creatorMap[item.created_by] || null;
        
        // Ensure scoring_config is an object
        if (typeof item.scoring_config === 'string') {
          try {
            item.scoring_config = JSON.parse(item.scoring_config);
          } catch (e) {
            item.scoring_config = {};
          }
        }
        
        return item;
      });

      return res.status(200).json({
        status: true,
        data: result
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
      
      // Step 1: Ambil data batch, sessions, participants, sections, groups, questions
      // Tanpa JOIN ke tabel 'users'
      const data = await batch.findByPk(idBatch, {
        include: [
          { model: batchsession, as: 'sessions' },
          {
            model: batchparticipant,
            as: "participants",
            include: [
              { model: payment, as: 'payments' },
            ]
          },
          {
            model: section,
            as: 'sections',
            include: [
              { 
                model: group, 
                as: 'groups',
                include: [{ model: question, as: 'questions' }]
              },
              { model: question, as: 'questions' }
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

      // Step 2: Ambil semua User ID yang terlibat (creator dan participants)
      const participantUserIds = (data.participants || []).map(p => p.userId).filter(Boolean);
      const allUserIds = [...new Set([data.created_by, ...participantUserIds].filter(Boolean))];

      let userMap = {};
      if (allUserIds.length > 0) {
        const users = await user.findAll({
          where: { uid: allUserIds },
          attributes: ['uid', 'name', 'email', 'picture'],
          include: [{ model: detailuser, as: 'detailuser' }]
        });
        users.forEach(u => { userMap[u.uid] = u.toJSON(); });
      }

      // Step 3: Map kembali data user ke objek data
      const responseData = data.toJSON();
      
      // Pasang creator
      responseData.creator = userMap[responseData.created_by] || null;
      
      // Ensure scoring_config is an object
      if (typeof responseData.scoring_config === 'string') {
        try {
          responseData.scoring_config = JSON.parse(responseData.scoring_config);
        } catch (e) {
          responseData.scoring_config = {};
        }
      }
      
      // Pasang user ke masing-masing participant
      if (responseData.participants) {
        responseData.participants = responseData.participants.map(p => ({
          ...p,
          user: userMap[p.userId] || null
        }));
      }

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

      // Hitung total group dan soal per section dan global
      let totalGroups = 0;
      let totalQuestions = 0;

      if (responseData.sections) {
        responseData.sections = responseData.sections.map(sec => {
          const sectionGroupsCount = sec.groups ? sec.groups.length : 0;
          
          // Hitung soal dari dua sumber: langsung di section dan di dalam groups
          const directQuestionsCount = sec.questions ? sec.questions.length : 0;
          const groupedQuestionsCount = sec.groups ? sec.groups.reduce((acc, g) => {
            return acc + (g.questions ? g.questions.length : 0);
          }, 0) : 0;

          const sectionQuestionsCount = directQuestionsCount + groupedQuestionsCount;

          totalGroups += sectionGroupsCount;
          totalQuestions += sectionQuestionsCount;

          return {
            ...sec,
            totalGroups: sectionGroupsCount,
            totalQuestions: sectionQuestionsCount
          };
        });
      }

      responseData.totalGroups = totalGroups;
      responseData.totalQuestions = totalQuestions;

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

      // Ensure scoring_config is properly handled
      if (updateData.scoring_config) {
        let sc = updateData.scoring_config;
        if (typeof sc === 'string') {
          try {
            sc = JSON.parse(sc);
          } catch (e) {
            sc = {};
          }
        }
        
        // Ensure initialScore is a number if we are in RAW mode or it's specifically provided
        if (updateData.scoring_type === 'RAW' || sc.initialScore !== undefined) {
          sc.initialScore = parseInt(sc.initialScore) || 0;
        }
        
        updateData.scoring_config = sc;
      }

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
      const responseData = updatedBatch.toJSON();
      
      // Ensure scoring_config is an object
      if (typeof responseData.scoring_config === 'string') {
        try {
          responseData.scoring_config = JSON.parse(responseData.scoring_config);
        } catch (e) {
          responseData.scoring_config = {};
        }
      }

      return res.status(200).json({
        status: true,
        data: responseData
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

      // 1. Guard: Cek apakah sudah ada peserta
      const participantCount = await batchparticipant.count({ where: { batchId: idBatch } });
      if (participantCount > 0) {
        return res.status(400).json({
          status: false,
          message: `Tidak dapat menghapus batch yang sudah memiliki ${participantCount} peserta.`
        });
      }

      const deleted = await batch.destroy({
        where: { idBatch }
      });

      if (!deleted) {
        return res.status(404).json({
          status: false,
          message: 'Batch tidak ditemukan'
        });
      }

      return res.status(200).json({
        status: true,
        message: 'Batch berhasil dihapus'
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: 'Gagal menghapus batch',
        error: error.message
      });
    }
  }
};