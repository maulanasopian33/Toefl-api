const ScoringService = require('../services/scoringService');
const { logger } = require('../utils/logger');
const { getCache, setCache, deleteCache } = require('../services/cache.service');

const CACHE_KEY_ALL = 'scoring:all';
const CACHE_KEY_DETAIL = (id) => `scoring:detail:${id}`;
const CACHE_TTL = 300; // 5 menit

/**
 * Controller to handle Scoring Table requests
 */
class ScoringController {
  /**
   * List all scoring tables
   */
  static async index(req, res, next) {
    try {
      // Cek cache
      const cached = await getCache(CACHE_KEY_ALL);
      if (cached) {
        return res.set('X-Cache', 'HIT').status(200).json(cached);
      }

      const tables = await ScoringService.getAllTables();
      const response = {
        status: true,
        message: 'Scoring tables retrieved successfully',
        data: tables
      };

      await setCache(CACHE_KEY_ALL, response, CACHE_TTL);
      res.set('X-Cache', 'MISS').status(200).json(response);
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

      // Cek cache
      const cached = await getCache(CACHE_KEY_DETAIL(id));
      if (cached) {
        return res.set('X-Cache', 'HIT').status(200).json(cached);
      }

      const table = await ScoringService.getTableById(id);
      const response = {
        status: true,
        message: 'Scoring table details retrieved successfully',
        data: table
      };

      await setCache(CACHE_KEY_DETAIL(id), response, CACHE_TTL);
      res.set('X-Cache', 'MISS').status(200).json(response);
    } catch (error) {
      if (error.message === 'Scoring table not found') {
        return res.status(404).json({ status: false, message: error.message });
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
        return res.status(400).json({ status: false, message: 'Name is required' });
      }

      const table = await ScoringService.createTable({ name, description, details });
      logger.info(`Scoring table created: ${table.name} (ID: ${table.id})`);

      // Invalidasi list cache
      await deleteCache(CACHE_KEY_ALL);

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

      // Invalidasi cache terkait
      await Promise.all([
        deleteCache(CACHE_KEY_ALL),
        deleteCache(CACHE_KEY_DETAIL(id)),
      ]);

      res.status(200).json({
        status: true,
        message: 'Scoring table updated successfully',
        data: table
      });
    } catch (error) {
      if (error.message === 'Scoring table not found') {
        return res.status(404).json({ status: false, message: error.message });
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

      // Invalidasi cache terkait
      await Promise.all([
        deleteCache(CACHE_KEY_ALL),
        deleteCache(CACHE_KEY_DETAIL(id)),
      ]);

      res.status(200).json({
        status: true,
        message: 'Scoring table deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Scoring table not found') {
        return res.status(404).json({ status: false, message: error.message });
      }
      next(error);
    }
  }
}

module.exports = ScoringController;
