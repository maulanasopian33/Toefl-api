'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('batchparticipants', 'status', {
      type: Sequelize.ENUM('pending', 'active', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('batchparticipants', 'status');
    // Note: In some DBs, removing an ENUM type itself might require extra steps if it's the only column using it
  }
};
