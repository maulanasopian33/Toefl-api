'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('batches', 'scoring_type', {
      type: Sequelize.ENUM('SCALE', 'RAW'),
      defaultValue: 'SCALE',
      allowNull: false
    });

    await queryInterface.addColumn('batches', 'scoring_config', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Configuration for scoring, e.g., initial value for RAW type'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('batches', 'scoring_type');
    await queryInterface.removeColumn('batches', 'scoring_config');
    
    // Note: Removing ENUM types in PostgreSQL might require extra steps, 
    // but for MySQL/SQLite column removal is usually enough.
  }
};
