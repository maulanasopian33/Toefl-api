'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('groups', [
      {
        idGroup: 'GRP001',
        passage: 'Percakapan antara dua orang tentang perjalanan.',
        batchId: 'BATCH001',
        sectionId: 'SEC001',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('groups', null, {});
  }
};
