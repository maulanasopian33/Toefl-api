const { scoringtable, scoringdetail, sequelize } = require('../models');
const { logger } = require('../utils/logger');

/**
 * Service to manage Scoring Tables and Details
 */
class ScoringService {
  /**
   * Get all scoring tables
   */
  static async getAllTables() {
    try {
      return await scoringtable.findAll({
        include: [{ model: scoringdetail, as: 'details' }],
        order: [['createdAt', 'DESC']]
      });
    } catch (error) {
      logger.error(`ScoringService.getAllTables error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get scoring table by ID
   */
  static async getTableById(id) {
    try {
      const table = await scoringtable.findByPk(id, {
        include: [{ model: scoringdetail, as: 'details' }]
      });
      if (!table) throw new Error('Scoring table not found');
      return table;
    } catch (error) {
      logger.error(`ScoringService.getTableById error: ${error.message}`, { id });
      throw error;
    }
  }

  /**
   * Create scoring table with details
   */
  static async createTable(data) {
    const transaction = await sequelize.transaction();
    try {
      const { name, description, details, is_default } = data;
      
      if (is_default) {
        await scoringtable.update({ is_default: false }, { where: { is_default: true }, transaction });
      }

      const table = await scoringtable.create({ name, description, is_default: !!is_default }, { transaction });

      if (details && Array.isArray(details)) {
        const detailsToCreate = details.map(detail => ({
          ...detail,
          scoring_table_id: table.id
        }));
        await scoringdetail.bulkCreate(detailsToCreate, { transaction });
      }

      await transaction.commit();
      return await this.getTableById(table.id);
    } catch (error) {
      await transaction.rollback();
      logger.error(`ScoringService.createTable error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update scoring table and sync details
   */
  static async updateTable(id, data) {
    const transaction = await sequelize.transaction();
    try {
      const { name, description, details, is_default } = data;
      const table = await scoringtable.findByPk(id);
      if (!table) throw new Error('Scoring table not found');

      if (is_default && !table.is_default) {
        await scoringtable.update({ is_default: false }, { where: { is_default: true }, transaction });
      }

      await table.update({ name, description, is_default: is_default !== undefined ? !!is_default : table.is_default }, { transaction });

      if (details && Array.isArray(details)) {
        await scoringdetail.destroy({
          where: { scoring_table_id: id },
          transaction
        });

        const detailsToCreate = details.map(detail => ({
          ...detail,
          scoring_table_id: id
        }));
        await scoringdetail.bulkCreate(detailsToCreate, { transaction });
      }

      await transaction.commit();
      return await this.getTableById(id);
    } catch (error) {
      await transaction.rollback();
      logger.error(`ScoringService.updateTable error: ${error.message}`, { id });
      throw error;
    }
  }

  /**
   * Delete scoring table
   */
  static async deleteTable(id) {
    try {
      const table = await scoringtable.findByPk(id);
      if (!table) throw new Error('Scoring table not found');
      
      await table.destroy();
      return true;
    } catch (error) {
      logger.error(`ScoringService.deleteTable error: ${error.message}`, { id });
      throw error;
    }
  }
}

module.exports = ScoringService;
