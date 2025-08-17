'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('batches', {
      idBatch: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
      },
      namaBatch: {
        type: Sequelize.STRING
      },
      deskripsiBatch: {
        type: Sequelize.TEXT
      },
      tanggalMulai: {
        type: Sequelize.DATE
      },
      tanggalSelesai: {
        type: Sequelize.DATE
      },
      batasMaksimalPeserta: {
        type: Sequelize.INTEGER
      },
      statusBatch: {
        type: Sequelize.STRING
      },
      intruksiKhusus: {
        type: Sequelize.TEXT
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
    await queryInterface.dropTable('batches');
  }
};