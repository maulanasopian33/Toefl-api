'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('userAnswers', [
      {
        userId: 1,
        batchId: 'BATCH001',
        sectionId: 'SEC001',
        questionId: 'Q001',
        optionId: 'OPT001',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('userAnswers', null, {});
  }
};
