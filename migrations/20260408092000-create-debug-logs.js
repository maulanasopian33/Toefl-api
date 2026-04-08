'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('debug_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      level: {
        type: Sequelize.ENUM('INFO', 'DEBUG', 'WARN', 'ERROR'),
        defaultValue: 'DEBUG'
      },
      context: {
        type: Sequelize.JSON,
        allowNull: true
      },
      source: {
        type: Sequelize.ENUM('FE', 'BE'),
        defaultValue: 'BE'
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_general_ci'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('debug_logs');
  }
};
