'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    // Menambahkan kolom deskripsi
    await queryInterface.addColumn('batches', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 3600, // dalam detik (contoh: 1 jam)
      comment: 'Durasi ujian dalam detik'
    });
  },

  async down(queryInterface, Sequelize) {
    // Menghapus kolom status
    await queryInterface.removeColumn('batches', 'duration');
  }
};