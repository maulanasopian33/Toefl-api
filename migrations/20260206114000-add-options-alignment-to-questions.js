'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('questions', 'options_alignment', {
      type: Sequelize.ENUM('LTR', 'RTL'),
      defaultValue: 'LTR',
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('questions', 'options_alignment');
    // Note: We might want to drop the ENUM type as well if the DB supports it, 
    // but column removal is the primary concern.
  }
};
