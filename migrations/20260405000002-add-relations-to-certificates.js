'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('certificates');

    // Tambah batchId — relasi ke batch ujian
    if (!tableDesc.batchId) {
      await queryInterface.addColumn('certificates', 'batchId', {
        type: Sequelize.STRING, // sesuai tipe batchId di userresult (STRING)
        allowNull: true,
        comment: 'Batch ujian yang sertifikat ini berkaitan'
      });
    }

    // Tambah userResultId — relasi ke userresult
    if (!tableDesc.userResultId) {
      await queryInterface.addColumn('certificates', 'userResultId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID userresult (hasil ujian spesifik) yang di-generate sertifikatnya'
      });
    }

    // Tambah templateFormatId — template yang digunakan saat generate
    if (!tableDesc.templateFormatId) {
      await queryInterface.addColumn('certificates', 'templateFormatId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID certificate_template_format yang digunakan saat generate'
      });
    }

    // Tambah generated_data — snapshot data saat generate (audit trail)
    if (!tableDesc.generated_data) {
      await queryInterface.addColumn('certificates', 'generated_data', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Snapshot userData dan mappingData saat sertifikat di-generate'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('certificates');

    if (tableDesc.generated_data)   await queryInterface.removeColumn('certificates', 'generated_data');
    if (tableDesc.templateFormatId) await queryInterface.removeColumn('certificates', 'templateFormatId');
    if (tableDesc.userResultId)     await queryInterface.removeColumn('certificates', 'userResultId');
    if (tableDesc.batchId)          await queryInterface.removeColumn('certificates', 'batchId');
  }
};
