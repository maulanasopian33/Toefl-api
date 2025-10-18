'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('questions', {
      idQuestion: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      text: {
        type: Sequelize.TEXT
      },
      type: {
        type: Sequelize.STRING
      },
      groupId: {
        type: Sequelize.STRING,
        references: { model: 'groups', key: 'idGroup' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sectionId: {
        type: Sequelize.STRING,
        references: { model: 'sections', key: 'idSection' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('questions');
  }
};