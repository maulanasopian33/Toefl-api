'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('payments', 'invoiceNumber', {
      type: Sequelize.STRING,
      allowNull: true, // Biarkan null untuk data lama agar tidak error saat migrasi
      unique: true,    // Pastikan unik untuk data baru
      after: 'participantId' // Opsional: menempatkan kolom setelah participantId agar rapi
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('payments', 'invoiceNumber');
  }
};