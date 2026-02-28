'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('userresults', 'status', {
      type: Sequelize.ENUM('PENDING', 'COMPLETED', 'FAILED'),
      allowNull: false,
      defaultValue: 'COMPLETED' // Data lama dianggap COMPLETED
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('userresults', 'status');
  }
};
