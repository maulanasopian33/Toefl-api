'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
    await queryInterface.bulkInsert('settings', [{
      nama_aplikasi: 'Aplikasi TOEFL',
      nama_pendek: 'TOEFL App',
      tagline: 'Platform Latihan TOEFL Online',
      deskripsi_singkat: 'Selamat datang di aplikasi latihan TOEFL. Tingkatkan skormu bersama kami!',
      id_aplikasi: 'com.toefl.app.v1',
      warna_utama: '#1A73E8',
      nama_organisasi: 'Lembaga Pendidikan Anda',
      email_support: 'support@domain.com',
      website: 'https://www.domain.com',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('settings', null, {});
  }
};