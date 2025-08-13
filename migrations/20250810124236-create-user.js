'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      uid: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      email: {
        type: Sequelize.STRING
      },
       email_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      picture: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lastLogin: {
        type: Sequelize.DATE,
        allowNull: false
      },
      role: {
        type: Sequelize.STRING,
        defaultValue: 'user'
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
    await queryInterface.dropTable('users');
  }
};