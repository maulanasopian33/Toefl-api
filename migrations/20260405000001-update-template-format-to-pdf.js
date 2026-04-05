'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('certificate_template_formats');

    // 1. Rename file_docx → file_pdf (jika kolom file_docx masih ada)
    if (tableDesc.file_docx) {
      await queryInterface.renameColumn(
        'certificate_template_formats',
        'file_docx',
        'file_pdf'
      );
    }

    // 2. Jika file_pdf belum ada sama sekali (fresh install), tambahkan
    if (!tableDesc.file_docx && !tableDesc.file_pdf) {
      await queryInterface.addColumn('certificate_template_formats', 'file_pdf', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // 3. Tambah kolom nexaplot_config untuk menyimpan NXCFG-... string
    if (!tableDesc.nexaplot_config) {
      await queryInterface.addColumn('certificate_template_formats', 'nexaplot_config', {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: 'Encoded nexaplot design config string (NXCFG-...)'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('certificate_template_formats');

    // Rollback: hapus nexaplot_config
    if (tableDesc.nexaplot_config) {
      await queryInterface.removeColumn('certificate_template_formats', 'nexaplot_config');
    }

    // Rollback: rename file_pdf → file_docx
    if (tableDesc.file_pdf) {
      await queryInterface.renameColumn(
        'certificate_template_formats',
        'file_pdf',
        'file_docx'
      );
    }
  }
};
