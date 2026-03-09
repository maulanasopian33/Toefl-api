'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('batches', 'passing_score', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Minimum total score to pass/get certificate. NULL means no threshold is set.'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('batches', 'passing_score');
  }
};
