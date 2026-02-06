'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('settings', 'hero_title', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('settings', 'hero_subtitle', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('settings', 'hero_title');
    await queryInterface.removeColumn('settings', 'hero_subtitle');
  }
};
