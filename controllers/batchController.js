// controllers/batchController.js

const db = require('../models');
const { generateProfilePic } = require('../utils/profilePic');
const { logger } = require('../utils/logger');

// CREATE: Menambahkan batch baru (hanya admin)
exports.createBatch = async (req, res, next) => {
  try {
    const newBatch = await db.batch.create(req.body, { user: req.user });
    res.status(201).json({
        status : true,
        message: 'Batch berhasil dibuat.',
        data: newBatch
    });
  } catch (error) {
    next(error);
  }
};

// READ: Mendapatkan semua batch
exports.getAllBatches = async (req, res, next) => {
  try {
    const { uid } = req.user; // Dapatkan UID pengguna yang sedang login

    // 1. Ambil semua batch yang tersedia, urutkan dari yang terbaru
    const allBatches = await db.batch.findAll({
      order: [['createdAt', 'DESC']]
    });

    // 2. Ambil semua ID batch yang sudah diikuti oleh pengguna
    const userParticipations = await db.batchparticipant.findAll({
      where: { userId: uid },
      attributes: ['batchId']
    });
    const joinedBatchIds = new Set(userParticipations.map(p => p.batchId));

    // 3. Tambahkan status 'isJoined' ke setiap batch
    const batchesWithStatus = allBatches.map(batch => {
      const batchJSON = batch.toJSON();
      return {
        ...batchJSON,
        isJoined: joinedBatchIds.has(batchJSON.idBatch)
      };
    });

    res.status(200).json({
      status: true,
      message: 'Semua batch berhasil diambil.',
      data: batchesWithStatus
    });
  } catch (error) {
    next(error);
  }
};

// READ: Mendapatkan satu batch berdasarkan idBatch
exports.getBatchById = async (req, res, next) => {
  try {
    const batch = await db.batch.findAll({
      where: {
        idBatch: req.params.idBatch
      },
      include : [
        { 
          model: db.batchparticipant , 
          as: "participants", 
          include: [
            { model: db.user, as: "user", attributes: ['name', 'email', 'picture'] },
            { model: db.payment, as: 'payments' } // Tambahkan ini untuk menyertakan data pembayaran
          ] 
        }
      ]
    });
    if (!batch) {
      return res.status(404).json({ 
          status : false,
          message: 'Batch tidak ditemukan.'
      });
    }
    const plainBatches = batch.map(b => b.toJSON());
    const formatedBatch = plainBatches.map((batch) => {
      return {
        ...batch,
        participants: batch.participants.map((participant) => {
          let picture = `http://localhost:5000${participant.user.picture}`
          if (!participant.user.picture) {
            picture = generateProfilePic(participant.user.name || participant.user.email)
          }
          return {
            name: participant.user.name,
            profilePic: picture,
            ...participant // Sertakan sisa data participant, termasuk pembayaran
          };
        }),
      };
    });

    res.status(200).json({
      status : true,
      message: 'Batch berhasil diambil.',
      data: formatedBatch[0]
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE: Mengubah data batch (hanya admin)
exports.updateBatch = async (req, res, next) => {
  try {
    const batch = await db.batch.findByPk(req.params.idBatch);
    if (!batch) {
      return res.status(404).json({ status :false, message: 'Batch tidak ditemukan.' });
    }
    await batch.update(req.body, { user: req.user });
    res.status(200).json({
        status : false,
      message: 'Batch berhasil diperbarui.',
      data: batch
    });
  } catch (error) {
    next(error);
  }
};

// DELETE: Menghapus batch (hanya admin)
exports.deleteBatch = async (req, res, next) => {
  try {
    const batch = await db.batch.findByPk(req.params.idBatch);
    if (!batch) {
      return res.status(404).json({ status:false,message: 'Batch tidak ditemukan.' });
    }
    await batch.destroy({ user: req.user });
    res.status(200).json({ status:true, message: 'Batch berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};