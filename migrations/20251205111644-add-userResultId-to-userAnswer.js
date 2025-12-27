'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('useranswers', 'userResultId', {
      type: Sequelize.INTEGER,
      references: {
        model: 'userresults', // Pastikan nama tabel ini sesuai dengan di database Anda
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL', // Atau 'CASCADE' jika Anda ingin jawaban ikut terhapus saat hasil tes dihapus
      allowNull: true, // Izinkan null untuk data lama yang mungkin tidak memiliki relasi ini
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('useranswers', 'userResultId');
  }
};
