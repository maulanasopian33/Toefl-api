'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('batches', 'price', {
      type: Sequelize.DECIMAL(10, 2), // Atau INTEGER jika harga selalu bulat
      allowNull: false, // Sesuaikan dengan kebutuhan Anda
      defaultValue: 0, // Nilai default jika diperlukan
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('batches', 'price');
  }
};
