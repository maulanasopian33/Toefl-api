// controllers/batchController.js

const db = require('../models');
const { generateProfilePic } = require('../utils/profilePic');

// CREATE: Menambahkan batch baru (hanya admin)
exports.createBatch = async (req, res, next) => {
  try {
    const newBatch = await db.batch.create(req.body);
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
    const allBatches = await db.batch.findAll();
    res.status(200).json({
        status : true,
      message: 'Semua batch berhasil diambil.',
      data: allBatches
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
        { model: db.batchParticipant , as: "participants", include: [{ model: db.user, as: "user" }] }
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
    await batch.update(req.body);
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
    await batch.destroy();
    res.status(200).json({ status:true, message: 'Batch berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};