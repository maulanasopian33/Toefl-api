// controllers/settingController.js

const db = require('../models');
const { getCache, setCache, deleteCache } = require('../services/cache.service');

const CACHE_KEY = 'settings:global';
const CACHE_TTL = 300; // 5 menit

/**
 * Mengambil data pengaturan aplikasi.
 * Akan membuat data default jika belum ada.
 */
exports.getSettings = async (req, res, next) => {
  try {
    // 1. Cek cache
    const cached = await getCache(CACHE_KEY);
    if (cached) {
      return res.set('X-Cache', 'HIT').status(200).json(cached);
    }

    // 2. Ambil dari DB
    let settings = await db.setting.findOne();
    if (!settings) {
      settings = await db.setting.create({});
    }

    const response = {
      status: true,
      message: 'Pengaturan berhasil diambil.',
      data: settings
    };

    // 3. Simpan ke cache
    await setCache(CACHE_KEY, response, CACHE_TTL);

    res.set('X-Cache', 'MISS').status(200).json(response);
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
      'mata_uang',
      'hero_title',
      'hero_subtitle',
      'payment_instructions_bank',
      'payment_instructions_offline',
      'payment_offline_details'
    ];

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
      await settings.update(updateData, { user: req.user });
    }

    // Invalidasi cache setelah update berhasil
    await deleteCache(CACHE_KEY);

    res.status(200).json({
      status: true,
      message: 'Pengaturan berhasil diperbarui.',
      data: settings
    });
  } catch (error) {
    next(error);
  }
};