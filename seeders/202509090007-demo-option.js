'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('options', [
      {
        idOption: 'OPT001',
        questionId: 'Q001',
        text: 'Their holiday plans',
        isCorrect: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        idOption: 'OPT002',
        questionId: 'Q001',
        text: 'A work meeting',
        isCorrect: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        idOption: 'OPT003',
        questionId: 'Q001',
        text: 'A medical appointment',
        isCorrect: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('options', null, {});
  }
};
