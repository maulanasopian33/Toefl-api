'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('certificate_template_formats', 'mapping_data', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Stores mapping array: [{"jinja": "{{nama}}", "db": "namaPeserta"}]'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('certificate_template_formats', 'mapping_data');
  }
};
