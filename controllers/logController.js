const { auditlog } = require('../models');
const { Op } = require('sequelize');
const Joi = require('joi');

const auditLogSchema = Joi.object({
  action: Joi.string().required(),
  module: Joi.string().required(),
  details: Joi.object().optional(),
  source: Joi.string().valid('backend', 'frontend').optional()
});

exports.createAuditLog = async (req, res, next) => {
  try {
    const { error, value } = auditLogSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ status: false, message: error.details[0].message });
    }
    
    const { action, module, details, source } = value;
    
    await auditlog.create({
      userId: req.user ? req.user.uid : null,
      action,
      module,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      source: source || 'frontend'
    });

    res.status(201).json({ status: true });
  } catch (error) {
    // We don't want to crash on logging failure
    console.error('Audit Log Controller Error:', error);
    res.status(500).json({ status: false });
  }
};

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

    const { count, rows } = await auditlog.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [
        { model: require('../models').user, as: 'user', attributes: ['name', 'email'] }
      ]
    });

    res.status(200).json({
      status: true,
      data: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        logs: rows
      }
    });
  } catch (error) {
    next(error);
  }
};
