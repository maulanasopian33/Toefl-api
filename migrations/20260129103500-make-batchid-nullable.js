'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Make batchId nullable in sections
    await queryInterface.changeColumn('sections', 'batchId', {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: 'batches',
        key: 'idBatch'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Make batchId nullable in groups
    await queryInterface.changeColumn('groups', 'batchId', {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: 'batches',
        key: 'idBatch'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert batchId to NOT NULL in sections
    await queryInterface.changeColumn('sections', 'batchId', {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: 'batches',
        key: 'idBatch'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Revert batchId to NOT NULL in groups
    await queryInterface.changeColumn('groups', 'batchId', {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: 'batches',
        key: 'idBatch'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  }
};
