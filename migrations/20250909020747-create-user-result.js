'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('userresults', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      batchId: {
        type: Sequelize.STRING,
        references: { model: 'batches', key: 'idBatch' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      totalQuestions: {
        type: Sequelize.INTEGER
      },
      correctCount: {
        type: Sequelize.INTEGER
      },
      wrongCount: {
        type: Sequelize.INTEGER
      },
      score: {
        type: Sequelize.INTEGER
      },
      submittedAt: {
        type: Sequelize.DATE
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
    await queryInterface.dropTable('userresults');
  }
};