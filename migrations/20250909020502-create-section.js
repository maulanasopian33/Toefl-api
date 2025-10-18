'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sections', {
      idSection: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      namaSection: {
        type: Sequelize.STRING
      },
      deskripsi: {
        type: Sequelize.TEXT
      },
      urutan: {
        type: Sequelize.INTEGER
      },
      batchId: {
        type: Sequelize.STRING,
        references: {
          model: 'batches',
          key: 'idBatch'
        },
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
    await queryInterface.dropTable('sections');
  }
};