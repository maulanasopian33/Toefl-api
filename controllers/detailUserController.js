// controllers/detailUserController.js

const db = require('../models');

/**
 * Membuat atau Memperbarui (Upsert) data DetailUser.
 * Jika data sudah ada, akan diperbarui. Jika belum, akan dibuat.
 */
exports.upsertDetailUser = async (req, res, next) => {
  try {
    const { namaLengkap, nim, fakultas, prodi } = req.body;
    const { uid } = req.user; // uid dari token yang sudah diverifikasi
    const { email, name, auth_time } = req.user; // Ambil email, name, dan auth_time dari token

    // --- SOLUSI: Pastikan user ada di tabel 'users' sebelum melanjutkan ---
    // Ini mencegah foreign key constraint error jika handleLogin belum dipanggil.
    await db.user.findOrCreate({
      where: { uid: uid },
      defaults: {
        uid: uid,
        email: email,
        name: name || email, // Gunakan nama dari token atau email sebagai fallback
        role: 'user', // Atur role default jika user baru dibuat
        lastLogin: new Date(auth_time * 1000) // Tambahkan lastLogin dari auth_time token
      }
    });

    // Menggunakan findOrCreate untuk mencari atau membuat entri baru
    const [detail, created] = await db.detailuser.findOrCreate({
      where: { uid },
      defaults: { uid, namaLengkap, nim, fakultas, prodi },
      user: req.user // Untuk logging hook
    });
 
    if (!created) {
      // Jika data sudah ada (tidak dibuat), perbarui dengan data baru
      await detail.update({ namaLengkap, nim, fakultas, prodi }, { user: req.user });
    }
 
    res.status(created ? 201 : 200).json({
      status: true,
      message: `Detail user berhasil ${created ? 'dibuat' : 'diperbarui'}.`,
      data: detail
    });
  } catch (error) {
    next(error);
  }
};
// Fungsi createDetailUser yang lama bisa dihapus atau diganti namanya jika masih diperlukan di tempat lain.

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