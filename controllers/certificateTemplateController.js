const db = require('../models');
const { logger } = require('../utils/logger');

/**
 * Get all certificate templates with their formats
 */
exports.getAllTemplates = async (req, res, next) => {
  try {
    const templates = await db.certificate_template.findAll({
      include: [{
        model: db.certificate_template_format,
        as: 'formats'
      }],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      status: true,
      data: templates
    });
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

    res.status(200).json({
      status: true,
      data: template
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or Update Template (Simplified for single file upload)
 */
exports.saveTemplate = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { id, name, status } = req.body;
    let fileDocx = req.file ? `/template/${req.file.filename}` : req.body.file_docx;

    let template;
    if (id) {
      // Update
      template = await db.certificate_template.findByPk(id);
      if (!template) {
        await transaction.rollback();
        return res.status(404).json({ status: false, message: 'Template not found' });
      }
      await template.update({ 
        name, 
        status: status === 'true' || status === true 
      }, { transaction });
    } else {
      // Create
      template = await db.certificate_template.create({ 
        name, 
        status: status === 'true' || status === true 
      }, { transaction });
    }

    // Simplified Formats (Always ensure at least one format exists with the uploaded file)
    // We treat this as a single-template-single-file system for the user, 
    // but keep the DB structure for compatibility.
    
    // Check if format already exists for this template
    let format = await db.certificate_template_format.findOne({
      where: { templateId: template.id },
      transaction
    });

    if (format) {
      // Update existing format
      await format.update({
        name: `Default Format for ${name}`,
        file_docx: fileDocx || format.file_docx,
        is_active: true
      }, { transaction });
    } else {
      // Create default format
      await db.certificate_template_format.create({
        templateId: template.id,
        name: `Default Format for ${name}`,
        file_docx: fileDocx || '',
        is_active: true
      }, { transaction });
    }

    await transaction.commit();

    const result = await db.certificate_template.findByPk(template.id, {
      include: [{ model: db.certificate_template_format, as: 'formats' }]
    });

    res.status(200).json({
      status: true,
      message: 'Template berhasil disimpan',
      data: result
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

    res.status(200).json({
      status: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
