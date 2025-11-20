'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('settings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nama_aplikasi: {
        type: Sequelize.STRING
      },
      nama_pendek: {
        type: Sequelize.STRING
      },
      tagline: {
        type: Sequelize.STRING
      },
      deskripsi_singkat: {
        type: Sequelize.TEXT
      },
      id_aplikasi: {
        type: Sequelize.STRING
      },
      logo_app: {
        type: Sequelize.STRING
      },
      favicon: {
        type: Sequelize.STRING
      },
      warna_utama: {
        type: Sequelize.STRING
      },
      mode_tampilan: {
        type: Sequelize.STRING,
        defaultValue: 'light'
      },
      nama_organisasi: {
        type: Sequelize.STRING
      },
      email_support: {
        type: Sequelize.STRING
      },
      website: {
        type: Sequelize.STRING
      },
      no_kontak: {
        type: Sequelize.STRING
      },
      bahasa_default: {
        type: Sequelize.STRING,
        defaultValue: 'id'
      },
      zona_waktu: {
        type: Sequelize.STRING,
        defaultValue: 'Asia/Jakarta'
      },
      mata_uang: {
        type: Sequelize.STRING,
        defaultValue: 'IDR'
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
    await queryInterface.dropTable('settings');
  }
};