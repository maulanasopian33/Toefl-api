// controllers/settingController.js

const db = require('../models');

/**
 * Mengambil data pengaturan aplikasi.
 * Akan membuat data default jika belum ada.
 */
exports.getSettings = async (req, res, next) => {
  try {
    let settings = await db.setting.findOne();

    if (!settings) {
      // Jika belum ada data, buat data pengaturan default
      settings = await db.setting.create({});
    }

    res.status(200).json({
      status: true,
      message: 'Pengaturan berhasil diambil.',
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Memperbarui data pengaturan aplikasi.
 * Hanya admin yang bisa mengakses.
 */
exports.updateSettings = async (req, res, next) => {
  try {
    // Daftar kolom yang diizinkan untuk diupdate dari request body
    const allowedFields = [
      'nama_aplikasi',
      'nama_pendek',
      'tagline',
      'deskripsi_singkat',
      'id_aplikasi',
      'logo_app',
      'favicon',
      'warna_utama',
      'mode_tampilan',
      'nama_organisasi',
      'email_support',
      'website',
      'no_kontak',
      'bahasa_default',
      'zona_waktu',
      'mata_uang'
    ];

    // Filter req.body untuk hanya menyertakan kolom yang diizinkan
    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const [settings, created] = await db.setting.findOrCreate({
      where: {},
      defaults: updateData
    });

    if (!created) {
      // Jika data sudah ada, perbarui
      await settings.update(updateData, { user: req.user });
    }

    res.status(200).json({
      status: true,
      message: 'Pengaturan berhasil diperbarui.',
      data: settings
    });
  } catch (error) {
    next(error);
  }
};