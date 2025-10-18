'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('sections', [
      {
        idSection: 'SEC001',
        namaSection: 'Listening',
        deskripsi: 'Bagian listening comprehension',
        urutan: 1,
        batchId: 'BATCH001',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        idSection: 'SEC002',
        namaSection: 'Structure',
        deskripsi: 'Bagian structure and written expression',
        urutan: 2,
        batchId: 'BATCH001',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('sections', null, {});
  }
};
