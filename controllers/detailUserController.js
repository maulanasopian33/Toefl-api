// controllers/detailUserController.js

const db = require('../models');
const { logger } = require('../utils/logger');

// CREATE: Menyimpan data DetailUser saat pertama kali login
exports.createDetailUser = async (req, res, next) => {
  try {
    const { namaLengkap, nim, fakultas, prodi } = req.body;
    const { uid, email } = req.user; // uid dan email dari token yang sudah diverifikasi

    // Pastikan hanya satu entri per pengguna
    const existingDetail = await db.detailuser.findOne({ where: { uid } });
    if (existingDetail) {
      return res.status(409).json({ message: 'Detail user sudah ada. Gunakan update.' });
    }

    // Buat entri baru di tabel DetailUser
    const newDetail = await db.detailuser.create({
      uid,
      namaLengkap,
      nim,
      fakultas,
      prodi,
    }, { user: req.user });

    res.status(201).json({
      message: 'Detail user berhasil dibuat.',
      data: newDetail
    });
  } catch (error) {
    next(error);
  }
};

// READ: Mendapatkan data DetailUser milik pengguna yang sedang login
exports.getDetailUser = async (req, res, next) => {
  try {
    const { uid } = req.user; // uid dari token yang sudah diverifikasi

    const detailUser = await db.detailuser.findOne({ where: { uid } });

    if (!detailUser) {
      return res.status(200).json({ 
        status : false,
        message: 'Detail user tidak ditemukan.'
      });
    }

    res.status(200).json({
      status : true,
      message: 'Detail user berhasil diambil.',
      data: detailUser
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE: Mengubah data DetailUser
exports.updateDetailUser = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { namaLengkap, nim, fakultas, prodi } = req.body;

    const detailUser = await db.detailuser.findOne({ where: { uid } });

    if (!detailUser) {
      return res.status(404).json({ message: 'Detail user tidak ditemukan.' });
    }

    // Update data
    await detailUser.update({ namaLengkap, nim, fakultas, prodi }, { user: req.user });

    res.status(200).json({
      message: 'Detail user berhasil diperbarui.',
      data: detailUser
    });
  } catch (error) {
    next(error);
  }
};

// DELETE: Menghapus data DetailUser (Opsional)
exports.deleteDetailUser = async (req, res, next) => {
  try {
    const { uid } = req.user;

    const detailUser = await db.detailuser.findOne({ where: { uid } });

    if (!detailUser) {
      return res.status(404).json({ message: 'Detail user tidak ditemukan.' });
    }

    await detailUser.destroy({ user: req.user });

    res.status(200).json({ message: 'Detail user berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};