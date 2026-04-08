
const db = require('../models')
const admin = require('../utils/firebase-auth');
const { downloadImage } = require('../utils/imageDownloader');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');

exports.handleLogin = async (req, res, next) => {
  try {
    const { uid, email, name, picture, email_verified, auth_time } = req.user;
    const localPicturePath = await downloadImage(picture, uid);

    // Ambil Role default (user) untuk pengguna baru
    const userRole = await db.role.findOne({ where: { name: 'user' } });
    const defaultRoleId = userRole ? userRole.id : null;

    // Use findOrCreate to handle both cases efficiently
    const [user, created] = await db.user.findOrCreate({
      where: { uid: uid },
      defaults: {
        uid: uid,
        email: email,
        name: name,
        email_verified: email_verified,
        picture: localPicturePath,
        lastLogin: new Date(auth_time * 1000), // Convert seconds to milliseconds
        roleId: defaultRoleId
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
    // Ambil data user terbaru beserta role-nya untuk memastikan konsistensi
    const userWithRole = await db.user.findByPk(uid, {
      include: [{ model: db.role, as: 'role', attributes: ['name'] }]
    });

    const roleName = userWithRole && userWithRole.role ? userWithRole.role.name : 'user';

    // Ini memastikan token pengguna selalu memiliki claim role yang up-to-date.
    await admin.auth().setCustomUserClaims(uid, { role: roleName });

    // Buat objek user yang akan dikirim sebagai respons, pastikan role-nya benar
    const responseUser = { ...req.user, role: roleName };

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
    const { 
      page = 1, limit = 10, search = '', 
      faculty = '', program = '', role = '',
      email_verified = '', status = '',
      sortBy = 'createdAt', sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;

    // 1. Build Where Clause
    const whereClause = {};
    const detailWhere = {};
    const roleWhere = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    if (faculty) detailWhere.fakultas = faculty;
    if (program) detailWhere.prodi = program;
    if (role) roleWhere.name = role;
    
    if (email_verified === 'verified') {
      whereClause.email_verified = true;
    } else if (email_verified === 'unverified') {
      whereClause.email_verified = false;
    }

    // status filter: Note - disability is in Firebase, not DB normally.
    // However, some implementations might sync it. Based on toggleUserStatus, 
    // it only updates Firebase. So we can't easily filter by "disabled" in DB 
    // unless we sync it. 

    // 2. Fetch Data with Pagination
    const { count, rows } = await db.user.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: db.detailuser, 
          as: 'detailuser',
          where: Object.keys(detailWhere).length > 0 ? detailWhere : undefined,
          required: Object.keys(detailWhere).length > 0
        },
        { 
          model: db.role, 
          as: 'role', 
          attributes: ['name'],
          where: Object.keys(roleWhere).length > 0 ? roleWhere : undefined,
          required: Object.keys(roleWhere).length > 0
        }
      ],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [[sortBy, sortOrder]]
    });

    // 3. Simple Summary Counts (Cacheable or separate queries)
    const [totalUsers, verifiedUsers] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { email_verified: true } })
    ]);

    // 4. Fetch Filter Options (Distinct values from DB)
    const [faculties, programs] = await Promise.all([
      db.detailuser.findAll({
        attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('fakultas')), 'fakultas']],
        where: { fakultas: { [Op.ne]: null } },
        raw: true
      }).then(res => res.map(r => r.fakultas).filter(Boolean)),
      db.detailuser.findAll({
        attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('prodi')), 'prodi']],
        where: { prodi: { [Op.ne]: null } },
        raw: true
      }).then(res => res.map(r => r.prodi).filter(Boolean))
    ]);

    // 5. Enrich rows with Firebase info (keep existing logic)
    const enrichedUsers = await Promise.all(rows.map(async (user) => {
      try {
        const firebaseUser = await admin.auth().getUser(user.uid);
        return {
          ...user.toJSON(),
          role: user.role ? user.role.name : null,
          disabled: firebaseUser.disabled,
          fb: firebaseUser
        };
      } catch (error) {
        return { ...user.toJSON(), role: user.role ? user.role.name : null, disabled: false };
      }
    }));

    res.status(200).json({
      status: true,
      message: 'List user berhasil diambil.',
      data: enrichedUsers,
      meta: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page, 10),
        limit: parseInt(limit, 10)
      },
      summary: {
        total: totalUsers,
        verified: verifiedUsers,
        active: totalUsers, // Approximation since we don't have disabled in DB
        disabled: 0
      },
      filterOptions: {
        faculties: faculties.sort(),
        programs: programs.sort()
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserByUid = async (req, res) => {
  const { uid } = req.user;
  try {
    // 1. Ambil data user dasar
    const user = await db.user.findOne({
      where: { uid: uid },
      include: [
        { model: db.detailuser, as: 'detailuser' },
        { model: db.role, as: 'role', attributes: ['name'] }
      ] // Sertakan data UserDetail dan Role
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User tidak ditemukan."
      });
    }

    // 2. Ambil statistik dan data tambahan secara paralel
    const [
      maxScore,
      totalUjian,
      totalSertifikat,
      totalPembayaran,
      recentExams,
      recentCertificates
    ] = await Promise.all([
      // Skor Tertinggi
      db.userresult.max('score', { where: { userId: uid } }),

      // Total Ujian
      db.userresult.count({ where: { userId: uid } }),

      // Total Sertifikat
      db.certificate.count({ where: { userId: uid } }),

      // Total Pembayaran (Sum amount where status = 'paid')
      db.payment.sum('amount', {
        where: { status: 'paid' },
        include: [{
          model: db.batchparticipant,
          as: 'participant',
          where: { userId: uid },
          attributes: []
        }]
      }),

      // Riwayat Ujian (3 Terakhir)
      db.userresult.findAll({
        where: { userId: uid },
        limit: 3,
        order: [['submittedAt', 'DESC']],
        include: [{ model: db.batch, as: 'batch', attributes: ['name', 'type'] }]
      }),

      // Sertifikat Terakhir (3 Terakhir)
      db.certificate.findAll({
        where: { userId: uid },
        limit: 3,
        order: [['createdAt', 'DESC']]
      })
    ]);

    const userData = user.toJSON();

    // Format response sesuai permintaan
    const responseData = {
      ...userData,
      role: user.role ? user.role.name : null,
      "skor_tertinggi": maxScore || 0,
      "total_Ujian": totalUjian || 0,
      "total_sertifikat": totalSertifikat || 0,
      "total_Pembayaran": totalPembayaran || 0,
      "riwayat_ujian": recentExams,
      "list_sertifikat": recentCertificates
    };

    res.status(200).json({
      status: true,
      message: "User berhasil diambil.",
      data: responseData
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({
      status: false,
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
  const { role: newRoleName } = req.body;

  try {
    // 1. Validasi input role (Cek di DB)
    const roleInstance = await db.role.findOne({ where: { name: newRoleName } });
    if (!roleInstance) {
      return res.status(400).json({
        status: false,
        message: `Role '${newRoleName}' tidak ditemukan.`
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
    await user.update({ roleId: roleInstance.id }, { user: req.user });

    // 4. Set custom claim di Firebase Authentication
    await admin.auth().setCustomUserClaims(uid, { role: roleInstance.name });

    // 5. Cabut semua sesi aktif pengguna untuk memaksa login ulang
    await admin.auth().revokeRefreshTokens(uid);

    logger.info({
      message: `User role for UID ${uid} changed to ${roleInstance.name}.`,
      action: 'USER_ROLE_CHANGED',
      user: req.user.email, // Admin yang melakukan aksi
      details: { targetUid: uid, newRole: roleInstance.name }
    });

    res.status(200).json({ status: true, message: `Role user berhasil diubah menjadi ${roleInstance.name}.` });
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
    // Format data agar lebih mudah digunakan di frontend
    const joinedBatches = participations
      .filter(p => p.batch) // Hanya ambil yang data batch-nya masih ada
      .map(p => ({
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

exports.loginAsUser = async (req, res, next) => {
  const { uid } = req.params;
  try {
    // 1. Pastikan user ada di Firebase
    const firebaseUser = await admin.auth().getUser(uid);
    
    // 2. Buat custom token
    const customToken = await admin.auth().createCustomToken(uid);

    // 3. Buat custom token untuk admin sendiri (untuk fitur Switch Back)
    const adminCustomToken = await admin.auth().createCustomToken(req.user.uid);

    logger.info({
      message: `Admin ${req.user.email} is logging in as user ${firebaseUser.email} (UID: ${uid})`,
      action: 'LOGIN_AS_USER',
      user: req.user.email,
      details: { targetUid: uid, targetEmail: firebaseUser.email }
    });

    res.status(200).json({
      status: true,
      message: 'Custom tokens generated successfully',
      data: {
        customToken: customToken,
        adminCustomToken: adminCustomToken
      }
    });
  } catch (error) {
    logger.error(`Failed to generate custom token for login-as: ${error.message}`);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ status: false, message: 'User tidak ditemukan di Firebase.' });
    }
    next(error);
  }
};
