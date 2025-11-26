
const db = require('../models')
const admin = require('../utils/firebase-auth');
const { downloadImage } = require('../utils/imageDownloader');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');

exports.handleLogin = async (req, res, next) => {
  try {
    const { uid, email, name, picture, email_verified, auth_time } = req.user;
    const localPicturePath = await downloadImage(picture, uid);
    // Use findOrCreate to handle both cases efficiently
    const [user, created] = await db.user.findOrCreate({
      where: { uid: uid },
      defaults: {
        uid: uid,
        email: email,
        name: name,
        email_verified: email_verified,
        picture: localPicturePath,
        lastLogin: new Date(auth_time * 1000) // Convert seconds to milliseconds
      },
      user: req.user // Pass user for hooks
    });

    // If the user already exists, update their data
    if (!created) {
      await user.update({
        email: email,
        name: name,
        email_verified: email_verified,
        picture: localPicturePath,
        lastLogin: new Date(auth_time * 1000),
      }, { user: req.user });
    }

    // --- PERBAIKAN: Sinkronkan role dari DB ke Firebase Custom Claim ---
    // Ini memastikan token pengguna selalu memiliki claim role yang up-to-date.
    await admin.auth().setCustomUserClaims(uid, { role: user.role });
    // if (user.role) {
    //   // Cek apakah claim yang ada sekarang berbeda dengan yang di DB
    //   // Ini untuk menghindari pemanggilan yang tidak perlu
    //   if (req.user.role !== user.role) {
    //   }
    // }
    
    // Buat objek user yang akan dikirim sebagai respons, pastikan role-nya benar
    const responseUser = { ...req.user, role: user.role };
    
    logger.info({
      message: `User login successful: ${email}`,
      action: created ? 'USER_CREATED' : 'USER_LOGIN',
      user: email,
      details: { 
        ...responseUser
       }
    });

    res.status(200).json({
      status: true,
      message: 'Login successful',
      data: responseUser, // Kirim data user yang sudah diperbarui dengan role dari DB
    });
  } catch (error) {
    next(error);
  }
};
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ]
    };

    const { count, rows } = await db.user.findAndCountAll({
      where: search ? whereClause : {},
      include: [{ model: db.detailuser, as: 'detailuser' }], // Sertakan data UserDetail
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['createdAt', 'DESC']]
    });

    if (rows.length === 0 && page > 1) {
      return res.status(200).json({
        status: true,
        message: 'Tidak ada lagi user yang ditemukan.',
        data: [],
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page, 10)
      });
    }

    // Enrich user data with Firebase Admin info
    const enrichedUsers = await Promise.all(rows.map(async (user) => {
      try {
        const firebaseUser = await admin.auth().getUser(user.uid);
        // Gabungkan data dari DB lokal dengan data dari Firebase
        return {
          ...user.toJSON(), // Data dari database (termasuk detailuser)
          disabled: firebaseUser.disabled,
          uuidFb : firebaseUser.uid,
          fb: firebaseUser
        };
      } catch (error) {
        logger.error(`Failed to get Firebase user for UID ${user.uid}: ${error.message}`);
        // Jika user tidak ditemukan di Firebase, tandai dan kembalikan data lokal
        return { ...user.toJSON(), firebase: { error: 'User not found in Firebase' } };
      }
    }));

    res.status(200).json({
      status: true,
      message: 'List user berhasil diambil.',
      data: enrichedUsers,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10)
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserByUid = async (req, res) => {
  const { uid } = req.user;
  try {
    const user = await db.user.findOne({
      where: { uid: uid },
      include: [{ model: db.detailuser }] // Sertakan data UserDetail
    });
    if (!user) {
      return res.status(404).json({ 
        status : false,
        message: "User tidak ditemukan."
     });
    }
    res.status(200).json({
        status : true,
        message: "User berhasil diambil.",
        data: user
    });
  } catch (err) {
    res.status(500).json({ 
        status  : false,
        message: "Terjadi kesalahan saat mengambil data user.",
        error: err.message
    });
  }
};

exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { disabled } = req.body; // Expecting { disabled: true } or { disabled: false }

    if (typeof disabled !== 'boolean') {
      return res.status(400).json({
        status: false,
        message: 'Request body tidak valid. Harap kirimkan { "disabled": boolean }.'
      });
    }

    await admin.auth().updateUser(uid, {
      disabled: disabled
    });

    const action = disabled ? 'dinonaktifkan' : 'diaktifkan';
    logger.info(`User account ${uid} has been ${action}.`);

    res.status(200).json({
      status: true,
      message: `User berhasil ${action}.`
    });
  } catch (error) {
    next(error);
  }
};

exports.changeUserRole = async (req, res, next) => {
  const { uid } = req.params;
  const { role: newRole } = req.body;

  try {
    // 1. Validasi input role
    const validRoles = ['admin', 'user'];
    if (!newRole || !validRoles.includes(newRole)) {
      return res.status(400).json({
        status: false,
        message: `Role tidak valid. Gunakan salah satu dari: ${validRoles.join(', ')}`
      });
    }

    // 2. Cari user di database lokal
    const user = await db.user.findOne({ where: { uid } });
    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'User tidak ditemukan di database lokal.'
      });
    }

    // 3. Update role di database lokal
    await user.update({ role: newRole }, { user: req.user });

    // 4. Set custom claim di Firebase Authentication
    await admin.auth().setCustomUserClaims(uid, { role: newRole });

    // 5. Cabut semua sesi aktif pengguna untuk memaksa login ulang
    await admin.auth().revokeRefreshTokens(uid);
    
    logger.info({
      message: `User role for UID ${uid} changed to ${newRole}.`,
      action: 'USER_ROLE_CHANGED',
      user: req.user.email, // Admin yang melakukan aksi
      details: { targetUid: uid, newRole: newRole }
    });

    res.status(200).json({ status: true, message: `Role user berhasil diubah menjadi ${newRole}.` });
  } catch (error) {
    logger.error(`Failed to change role for user ${uid}: ${error.message}`);
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  const { uid } = req.params;
  try {
    // 1. Hapus user dari Firebase Authentication
    await admin.auth().deleteUser(uid);

    // 2. Hapus user dari database lokal
    const user = await db.user.findOne({ where: { uid } });
    if (user) {
      await user.destroy({ user: req.user }); // Menggunakan destroy pada instance untuk trigger hooks
    } else {
      // Jika user tidak ada di DB lokal tapi ada di Firebase, tetap berikan pesan sukses
      logger.warn(`User with UID ${uid} was deleted from Firebase but not found in local DB.`);
      return res.status(200).json({
        status: true,
        message: 'User berhasil dihapus dari Firebase (tidak ditemukan di database lokal).'
      });
    }

    logger.info({
      message: `User account with UID ${uid} has been deleted.`,
      action: 'USER_DELETED',
      user: req.user.email, // email admin yang melakukan aksi
      details: { deletedUid: uid }
    });

    res.status(200).json({
      status: true,
      message: 'User berhasil dihapus dari Firebase dan database lokal.'
    });
  } catch (error) {
    logger.error(`Failed to delete user ${uid}: ${error.message}`);
    // Cek jika error karena user tidak ditemukan di Firebase
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ status: false, message: 'User tidak ditemukan di Firebase Authentication.' });
    }
    next(error);
  }
};

exports.getJoinedBatches = async (req, res, next) => {
  try {
    const { uid } = req.user; // Dapatkan UID dari pengguna yang sedang login

    const participations = await db.batchparticipant.findAll({
      where: { userId: uid },
      include: [
        {
          model: db.batch,
          as: 'batch', // Sertakan detail batch
        },
        {
          model: db.payment,
          as: 'payments', // Sertakan detail pembayaran
        }
      ],
      order: [[{ model: db.batch, as: 'batch' }, 'createdAt', 'DESC']] // Urutkan berdasarkan batch terbaru
    });

    if (!participations || participations.length === 0) {
      return res.status(200).json({
        status: true,
        message: 'Anda belum bergabung dengan batch manapun.',
        data: []
      });
    }

    // Format data agar lebih mudah digunakan di frontend
    const joinedBatches = participations.map(p => ({
      ...p.batch.toJSON(),
      paymentStatus: p.payments.length > 0 ? p.payments[0].status : 'not_started',
    }));

    res.status(200).json({
      status: true,
      message: 'Berhasil mengambil daftar batch yang telah diikuti.',
      data: joinedBatches
    });
  } catch (error) {
    next(error);
  }
};
