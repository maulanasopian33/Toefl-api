// controllers/mediaController.js

const fs = require('fs');
const path = require('path');
const db = require('../models');
const { Op } = require('sequelize');

/**
 * Mengelola unggahan file media.
 * Setelah file diunggah oleh middleware, fungsi ini akan mengembalikan URL-nya.
 */
exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: false, message: 'Tidak ada file yang diunggah.' });
    }

    const fileUrl = `/uploads/${req.file.filename}`; // Simpan sebagai path relatif

    // Simpan metadata ke database
    const media = await db.media.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: fileUrl,
    });

    res.json({
      status: true,
      message: 'File berhasil diunggah.',
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mengambil daftar semua file media dari database.
 */
exports.getAllMedia = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await db.media.findAndCountAll({
      where: {
        originalName: {
          [Op.like]: `%${search}%`
        }
      },
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil mengambil daftar media.',
      data: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Menghapus file media dari database dan file system.
 */
exports.deleteMedia = async (req, res, next) => {
  try {
    const { id } = req.params;
    const media = await db.media.findByPk(id);

    if (!media) {
      return res.status(404).json({ status: false, message: 'Media tidak ditemukan.' });
    }

    // Hapus file dari file system
    const filePath = path.join(__dirname, '../public', media.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Hapus record dari database
    await media.destroy();

    res.status(200).json({ status: true, message: 'Media berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};