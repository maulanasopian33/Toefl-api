const { auditlog } = require('../models');
const { Op } = require('sequelize');
const Joi = require('joi');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOG_DIR = path.join(__dirname, '../logs');

const auditLogSchema = Joi.object({
  action: Joi.string().required(),
  module: Joi.string().required(),
  message: Joi.string().optional(),
  level: Joi.string().optional(),
  details: Joi.object().optional(),
  source: Joi.string().valid('backend', 'frontend').optional()
});

// POST /logs/audit — Digunakan FE untuk mencatat aktivitas user
exports.createAuditLog = async (req, res, next) => {
  try {
    const { error, value } = auditLogSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ status: false, message: error.details[0].message });
    }

    const { action, module, details, source } = value;

    await auditlog.create({
      userId: req.user ? (req.user.uid || req.user.id || null) : null,
      action,
      module,
      details,
      ipAddress: req.ip || (req.connection && req.connection.remoteAddress),
      userAgent: req.get('User-Agent'),
      source: source || 'frontend'
    });

    res.status(201).json({ status: true });
  } catch (error) {
    console.error('Audit Log Controller Error:', error);
    res.status(500).json({ status: false });
  }
};

// GET /logs — Tampilkan audit log dari database (untuk admin)
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, module, userId, action, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (module) where.module = module;
    if (userId) where.userId = userId;
    if (action) where.action = { [Op.like]: `%${action}%` };
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    // Step 1: Ambil audit logs TANPA JOIN ke tabel users
    // (menghindari error collation mismatch antar tabel)
    const count = await auditlog.count({ where });
    const rows = await auditlog.findAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
      // Tidak gunakan include/JOIN — collation tabel users berbeda di production
    });

    // Step 2: Ambil data user secara terpisah menggunakan userId yang sudah ada
    const { user } = require('../models');
    const userIds = [...new Set(rows.map(r => r.userId).filter(Boolean))];
    
    let userMap = {};
    if (userIds.length > 0) {
      const users = await user.findAll({
        where: { uid: userIds },
        attributes: ['uid', 'name', 'email']
      });
      users.forEach(u => { userMap[u.uid] = u; });
    }

    // Step 3: Gabungkan data
    const logs = rows.map(log => ({
      ...log.toJSON(),
      user: userMap[log.userId] || null
    }));

    res.status(200).json({
      status: true,
      data: {
        totalItems: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page),
        logs
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /logs/system — Daftar file log sistem (file-based)
exports.listSystemLogs = async (req, res, next) => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      return res.status(200).json({ status: true, data: [] });
    }

    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const filePath = path.join(LOG_DIR, f);
        const stat = fs.statSync(filePath);
        return {
          filename: f,
          size: stat.size,
          sizeFormatted: formatBytes(stat.size),
          lastModified: stat.mtime,
          type: f.includes('http') ? 'HTTP Traffic' : 'Application'
        };
      })
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    res.status(200).json({ status: true, data: files });
  } catch (error) {
    next(error);
  }
};

// GET /logs/system/:filename?lines=100 — Baca isi file log (100 baris terakhir)
exports.getSystemLogContent = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const lines = parseInt(req.query.lines) || 100;

    // Security: pastikan hanya file .log di folder logs yang bisa diakses
    const safeName = path.basename(filename);
    if (!safeName.endsWith('.log')) {
      return res.status(400).json({ status: false, message: 'File tidak valid.' });
    }

    const filePath = path.join(LOG_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ status: false, message: 'File log tidak ditemukan.' });
    }

    // Baca N baris terakhir dari file
    const lastLines = await readLastLines(filePath, lines);

    res.status(200).json({
      status: true,
      data: {
        filename: safeName,
        lines: lastLines,
        totalLinesRead: lastLines.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper: Baca N baris terakhir dari file log
function readLastLines(filePath, n) {
  return new Promise((resolve, reject) => {
    const results = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });
    rl.on('line', line => {
      if (line.trim()) results.push(line);
    });
    rl.on('close', () => resolve(results.slice(-n)));
    rl.on('error', reject);
  });
}

// Helper: Format ukuran file
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
