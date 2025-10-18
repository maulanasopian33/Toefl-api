'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('groupAudioInstructions', [
      {
        groupId: 'GRP001',
        audioUrl: 'https://example.com/audio/conversation.mp3',
        description: 'Percakapan untuk soal listening group 1',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('groupAudioInstructions', null, {});
  }
};
