'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('sectionAudioInstructions', [
      {
        sectionId: 'SEC001',
        audioUrl: 'https://example.com/audio/listening-intro.mp3',
        description: 'Instruksi audio untuk listening section',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('sectionAudioInstructions', null, {});
  }
};
