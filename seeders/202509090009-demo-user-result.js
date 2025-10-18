'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('userResults', [
      {
        userId: 1,
        batchId: 'BATCH001',
        totalQuestions: 1,
        correctCount: 1,
        wrongCount: 0,
        score: 100,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('userResults', null, {});
  }
};
