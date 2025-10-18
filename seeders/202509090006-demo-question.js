'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('questions', [
      {
        idQuestion: 'Q001',
        text: 'What are the speakers talking about?',
        type: 'multiple-choice',
        groupId: 'GRP001',
        sectionId: 'SEC001',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('questions', null, {});
  }
};
