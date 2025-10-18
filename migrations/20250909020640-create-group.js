'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('groups', {
      idGroup: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      passage: {
        type: Sequelize.TEXT
      },
      batchId: {
        type: Sequelize.STRING,
        references: { model: 'batches', key: 'idBatch' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sectionId: {
        type: Sequelize.STRING,
        references: { model: 'sections', key: 'idSection' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('groups');
  }
};