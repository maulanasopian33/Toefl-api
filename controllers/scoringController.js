const ScoringService = require('../services/scoringService');
const { logger } = require('../utils/logger');

/**
 * Controller to handle Scoring Table requests
 */
class ScoringController {
  /**
   * List all scoring tables
   */
  static async index(req, res, next) {
    try {
      const tables = await ScoringService.getAllTables();
      res.status(200).json({
        status: true,
        message: 'Scoring tables retrieved successfully',
        data: tables
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific scoring table details
   */
  static async show(req, res, next) {
    try {
      const { id } = req.params;
      const table = await ScoringService.getTableById(id);
      res.status(200).json({
        status: true,
        message: 'Scoring table details retrieved successfully',
        data: table
      });
    } catch (error) {
      if (error.message === 'Scoring table not found') {
        return res.status(404).json({
          status: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Create a new scoring table
   */
  static async store(req, res, next) {
    try {
      const { name, description, details } = req.body;
      
      if (!name) {
        return res.status(400).json({
          status: false,
          message: 'Name is required'
        });
      }

      const table = await ScoringService.createTable({ name, description, details });
      
      logger.info(`Scoring table created: ${table.name} (ID: ${table.id})`);
      
      res.status(201).json({
        status: true,
        message: 'Scoring table created successfully',
        data: table
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an existing scoring table
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, details } = req.body;

      const table = await ScoringService.updateTable(id, { name, description, details });
      
      logger.info(`Scoring table updated: ${table.name} (ID: ${table.id})`);

      res.status(200).json({
        status: true,
        message: 'Scoring table updated successfully',
        data: table
      });
    } catch (error) {
      if (error.message === 'Scoring table not found') {
        return res.status(404).json({
          status: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Delete a scoring table
   */
  static async destroy(req, res, next) {
    try {
      const { id } = req.params;
      await ScoringService.deleteTable(id);
      
      logger.info(`Scoring table deleted (ID: ${id})`);

      res.status(200).json({
        status: true,
        message: 'Scoring table deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Scoring table not found') {
        return res.status(404).json({
          status: false,
          message: error.message
        });
      }
      next(error);
    }
  }
}

module.exports = ScoringController;
