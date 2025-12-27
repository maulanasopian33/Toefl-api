'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('certificates', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      certificateNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'users', // Sesuaikan dengan nama tabel user di DB (biasanya 'Users' atau 'users')
          key: 'uid'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      name: {
        type: Sequelize.STRING
      },
      event: {
        type: Sequelize.STRING
      },
      date: {
        type: Sequelize.DATEONLY
      },
      score: {
        type: Sequelize.INTEGER
      },
      qrToken: {
        type: Sequelize.STRING
      },
      verifyUrl: {
        type: Sequelize.STRING
      },
      pdfUrl: {
        type: Sequelize.STRING
      },
      externalPdfUrl: {
        type: Sequelize.STRING
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
    await queryInterface.dropTable('certificates');
  }
};