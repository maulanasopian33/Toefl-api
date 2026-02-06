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
 * Create or Update Template (with dynamic formats)
 */
exports.saveTemplate = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { id, name, status, formats } = req.body;

    let template;
    if (id) {
      // Update
      template = await db.certificate_template.findByPk(id);
      if (!template) {
        await transaction.rollback();
        return res.status(404).json({ status: false, message: 'Template not found' });
      }
      await template.update({ name, status }, { transaction });
    } else {
      // Create
      template = await db.certificate_template.create({ name, status }, { transaction });
    }

    // Handle Formats (Upsert logic)
    if (formats && Array.isArray(formats)) {
      const existingFormatIds = formats.filter(f => f.id).map(f => f.id);
      
      // Delete formats not in the request
      await db.certificate_template_format.destroy({
        where: {
          templateId: template.id,
          id: { [db.Sequelize.Op.notIn]: existingFormatIds }
        },
        transaction
      });

      for (const format of formats) {
        if (format.id) {
          // Update
          await db.certificate_template_format.update({
            name: format.name,
            file_docx: format.file_docx,
            is_active: format.is_active
          }, {
            where: { id: format.id, templateId: template.id },
            transaction
          });
        } else {
          // Create
          await db.certificate_template_format.create({
            templateId: template.id,
            name: format.name,
            file_docx: format.file_docx,
            is_active: format.is_active
          }, { transaction });
        }
      }
    }

    await transaction.commit();

    const updatedTemplate = await db.certificate_template.findByPk(template.id, {
      include: [{ model: db.certificate_template_format, as: 'formats' }]
    });

    res.status(200).json({
      status: true,
      message: 'Template saved successfully',
      data: updatedTemplate
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
