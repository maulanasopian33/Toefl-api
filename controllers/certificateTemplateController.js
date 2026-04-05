const db = require('../models');
const { logger } = require('../utils/logger');
const { getCache, setCache, deleteCache, clearByPattern } = require('../services/cache.service');

const CERT_CACHE_KEY_ALL    = 'cert:template:all';
const CERT_CACHE_KEY_DETAIL = (id) => `cert:template:detail:${id}`;
const CACHE_TTL             = 3600; // 1 jam

/**
 * Get all certificate templates with their formats
 */
exports.getAllTemplates = async (req, res, next) => {
  try {
    const cached = await getCache(CERT_CACHE_KEY_ALL);
    if (cached) {
      return res.set('X-Cache', 'HIT').status(200).json(cached);
    }

    const templates = await db.certificate_template.findAll({
      include: [{
        model: db.certificate_template_format,
        as: 'formats'
      }],
      order: [['createdAt', 'DESC']]
    });

    const response = { status: true, data: templates };
    await setCache(CERT_CACHE_KEY_ALL, response, CACHE_TTL);
    res.set('X-Cache', 'MISS').status(200).json(response);
  } catch (error) {
    logger.error('Error fetching certificate templates:', error);
    next(error);
  }
};

/**
 * Get single template by ID
 */
exports.getTemplateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const cached = await getCache(CERT_CACHE_KEY_DETAIL(id));
    if (cached) {
      return res.set('X-Cache', 'HIT').status(200).json(cached);
    }

    const template = await db.certificate_template.findByPk(id, {
      include: [{
        model: db.certificate_template_format,
        as: 'formats'
      }]
    });

    if (!template) {
      return res.status(404).json({
        status: false,
        message: 'Template not found'
      });
    }

    const response = { status: true, data: template };
    await setCache(CERT_CACHE_KEY_DETAIL(id), response, CACHE_TTL);
    res.set('X-Cache', 'MISS').status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get the currently active template format (single global active).
 * GET /certificate-templates/active
 */
exports.getActiveTemplate = async (req, res, next) => {
  try {
    const cacheKey = 'cert:template:active';
    const cached   = await getCache(cacheKey);
    if (cached) {
      return res.set('X-Cache', 'HIT').status(200).json(cached);
    }

    const format = await db.certificate_template_format.findOne({
      where   : { is_active: true },
      include : [{ model: db.certificate_template, as: 'template' }]
    });

    if (!format) {
      return res.status(404).json({
        status  : false,
        message : 'Tidak ada template aktif saat ini.'
      });
    }

    const response = { status: true, data: format };
    await setCache(cacheKey, response, CACHE_TTL);
    res.set('X-Cache', 'MISS').status(200).json(response);
  } catch (error) {
    logger.error('Error fetching active template:', error);
    next(error);
  }
};

/**
 * Create or Update Template.
 * Mendukung:
 *   - Upload file PDF base template (via multipart)
 *   - Simpan nexaplot_config (NXCFG-...) string dari designer
 *   - Simpan mapping_data variabel
 *   - Jika is_active = true, auto-deactivate semua template format lain
 */
exports.saveTemplate = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { id, name, status, nexaplot_config } = req.body;

    // Parse mapping_data dari multipart/form-data atau JSON
    let mapping_data = null;
    if (req.body.mapping_data) {
      try {
        mapping_data = typeof req.body.mapping_data === 'string'
          ? JSON.parse(req.body.mapping_data)
          : req.body.mapping_data;
      } catch (e) {
        logger.warn('Failed to parse mapping_data JSON:', e.message);
      }
    }

    // Tangani upload file PDF
    const filePdf = req.file ? `template/${req.file.filename}` : (req.body.file_pdf || null);

    // ── Upsert certificate_template (parent) ──────────────────────────────
    let template;
    const isActive = status === 'true' || status === true;

    if (id) {
      template = await db.certificate_template.findByPk(id);
      if (!template) {
        await transaction.rollback();
        return res.status(404).json({ status: false, message: 'Template tidak ditemukan.' });
      }
      await template.update({ name, status: isActive }, { transaction });
    } else {
      template = await db.certificate_template.create(
        { name, status: isActive },
        { transaction }
      );
    }

    // ── Jika is_active = true, deactivate semua format lain dulu ──────────
    if (isActive) {
      await db.certificate_template_format.update(
        { is_active: false },
        { where: {}, transaction }  // semua format
      );
    }

    // ── Upsert certificate_template_format (child) ────────────────────────
    let format = await db.certificate_template_format.findOne({
      where: { templateId: template.id },
      transaction
    });

    const formatPayload = {
      name             : `Format ${name}`,
      is_active        : isActive,
      // Update nexaplot_config jika dikirim
      ...(nexaplot_config ? { nexaplot_config } : {}),
      // Update file PDF jika ada file baru yang di-upload
      ...(filePdf        ? { file_pdf         : filePdf } : {}),
      // Update mapping_data jika dikirim
      ...(mapping_data !== null ? { mapping_data } : {})
    };

    if (format) {
      await format.update(formatPayload, { transaction });
    } else {
      await db.certificate_template_format.create(
        { templateId: template.id, ...formatPayload },
        { transaction }
      );
    }

    await transaction.commit();

    // Invalidasi cache
    await Promise.all([
      deleteCache(CERT_CACHE_KEY_ALL),
      deleteCache(CERT_CACHE_KEY_DETAIL(template.id)),
      deleteCache('cert:template:active')
    ]);

    const result = await db.certificate_template.findByPk(template.id, {
      include: [{ model: db.certificate_template_format, as: 'formats' }]
    });

    res.status(200).json({
      status  : true,
      message : 'Template berhasil disimpan.',
      data    : result
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error saving certificate template:', error);
    next(error);
  }
};

/**
 * Delete Template
 */
exports.deleteTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await db.certificate_template.findByPk(id);

    if (!template) {
      return res.status(404).json({
        status: false,
        message: 'Template not found'
      });
    }

    await template.destroy();

    // Invalidasi cache sertifikat
    await Promise.all([
      deleteCache(CERT_CACHE_KEY_ALL),
      deleteCache(CERT_CACHE_KEY_DETAIL(id))
    ]);

    res.status(200).json({
      status: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
