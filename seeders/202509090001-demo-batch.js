'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('batches', [{
      idBatch: 'BATCH001',
      namaBatch: 'TOAFL September',
      deskripsiBatch: 'Batch ujian TOAFL untuk bulan September',
      tanggalMulai: new Date(),
      tanggalSelesai: new Date(new Date().setDate(new Date().getDate() + 7)),
      batasMaksimalPeserta: 50,
      statusBatch: 'aktif',
      intruksiKhusus: 'Gunakan headset saat mengerjakan listening',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('batches', null, {});
  }
};
