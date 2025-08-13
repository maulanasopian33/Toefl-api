'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('detailusers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      uid: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true, // Pastikan setiap uid unik di tabel DetailUser
        references: {
          model: 'users', // Nama tabel yang dirujuk
          key: 'uid' // Kolom di tabel Users yang menjadi primary key
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      namaLengkap: {
        type: Sequelize.STRING
      },
      nim: {
        type: Sequelize.STRING
      },
      fakultas: {
        type: Sequelize.STRING
      },
      prodi: {
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
    await queryInterface.dropTable('detailusers');
  }
};