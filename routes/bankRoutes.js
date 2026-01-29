const express = require('express');
const router = express.Router();
const BankService = require('../services/bankService');
const { logger } = require('../utils/logger');

// List templates
router.get('/templates', async (req, res, next) => {
  try {
    const templates = await BankService.getTemplates();
    res.json({ status: true, data: templates });
  } catch (error) {
    next(error);
  }
});

// Import Section to Batch
router.post('/import/:sectionId/to-batch/:batchId', async (req, res, next) => {
  try {
    const { sectionId, batchId } = req.params;
    const newSection = await BankService.cloneSection(sectionId, batchId);
    
    logger.info(`Section ${sectionId} imported to Batch ${batchId} as ${newSection.idSection}`);
    
    res.status(201).json({ 
      status: true, 
      message: 'Section imported successfully', 
      data: newSection 
    });
  } catch (error) {
    next(error);
  }
});

// Create Template from Existing Section
router.post('/promote/:sectionId', async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const template = await BankService.cloneSection(sectionId, null);
    
    logger.info(`Section ${sectionId} promoted to Template ${template.idSection}`);
    
    res.status(201).json({ 
      status: true, 
      message: 'Section promoted to template successfully', 
      data: template 
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
