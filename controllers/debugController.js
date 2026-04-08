const db = require('../models');
const { Op } = require('sequelize');
const { debugLog } = require('../utils/debug');

exports.getDebugLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search = '', level = '', source = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (search) {
      whereClause.message = { [Op.like]: `%${search}%` };
    }
    if (level) {
      whereClause.level = level;
    }
    if (source) {
      whereClause.source = source;
    }

    // Step 1: Ambil debug logs TANPA JOIN ke tabel users
    // (menghindari error collation mismatch antar tabel di production)
    const { count, rows } = await db.debuglog.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['createdAt', 'DESC']]
    });

    // Step 2: Ambil data user secara terpisah
    const userIds = [...new Set(rows.map(r => r.userId).filter(Boolean))];
    let userMap = {};
    
    if (userIds.length > 0) {
      const users = await db.user.findAll({
        where: { uid: userIds },
        attributes: ['uid', 'name', 'email']
      });
      users.forEach(u => {
        userMap[u.uid] = u;
      });
    }

    // Step 3: Gabungkan data di application layer
    const debugLogs = rows.map(log => ({
      ...log.toJSON(),
      user: userMap[log.userId] || null
    }));

    res.status(200).json({
      status: true,
      data: debugLogs,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10)
    });
  } catch (error) {
    next(error);
  }
};

exports.clearDebugLogs = async (req, res, next) => {
  try {
    await db.debuglog.destroy({ where: {} });
    res.status(200).json({ status: true, message: 'All debug logs cleared.' });
  } catch (error) {
    next(error);
  }
};

exports.storeDebugLog = async (req, res, next) => {
  try {
    const { message, context, level } = req.body;
    // Source dipaksa FE jika dikirim via API ini
    await debugLog(message, context, level || 'DEBUG', 'FE', req.user ? req.user.uid : null);
    res.status(201).json({ status: true, message: 'Debug log stored.' });
  } catch (error) {
    next(error);
  }
};
