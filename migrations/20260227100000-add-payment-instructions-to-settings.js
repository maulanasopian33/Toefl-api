'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('settings', 'payment_instructions_bank', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'JSON string of bank payment instructions'
    });
    await queryInterface.addColumn('settings', 'payment_instructions_offline', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'JSON string of offline payment instructions'
    });
    await queryInterface.addColumn('settings', 'payment_offline_details', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'JSON string of offline payment details (location, hours, notes)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('settings', 'payment_instructions_bank');
    await queryInterface.removeColumn('settings', 'payment_instructions_offline');
    await queryInterface.removeColumn('settings', 'payment_offline_details');
  }
};
