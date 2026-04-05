'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CertificateTemplateFormat extends Model {
    static associate(models) {
      CertificateTemplateFormat.belongsTo(models.certificate_template, {
        foreignKey: 'templateId',
        as: 'template'
      });
    }
  }
  CertificateTemplateFormat.init({
    templateId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    /**
     * Path relatif ke file PDF base template di storage
     * Contoh: "template/template-uuid.pdf"
     */
    file_pdf: {
      type: DataTypes.STRING,
      allowNull: true
    },
    /**
     * Encoded nexaplot design config string (NXCFG-...)
     * Dihasilkan oleh NexaplotEditor saat admin menyimpan desain.
     * Digunakan oleh NexaplotEngine saat generate.
     */
    nexaplot_config: {
      type: DataTypes.TEXT('long'),
      allowNull: true
    },
    /**
     * Mapping variabel nexaplot → sumber data aktual.
     * Format array:
     * [
     *   { "variable": "namaPeserta",  "source": "detailuser.namaLengkap", "type": "text",  "label": "Nama Peserta" },
     *   { "variable": "nilaiTotal",   "source": "userresult.score",       "type": "text",  "label": "Nilai Total" },
     *   { "variable": "nilaiSection", "source": "section_scores_table",   "type": "table", "label": "Rincian Section" },
     *   { "variable": "qrVerifikasi", "source": "certificate.verifyUrl",  "type": "qr",   "label": "QR Verifikasi" },
     *   { "variable": "foto",         "source": "user.picture",           "type": "image", "label": "Foto Peserta" }
     * ]
     */
    mapping_data: {
      type: DataTypes.JSON,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Hanya satu format yang boleh aktif secara global'
    }
  }, {
    sequelize,
    modelName: 'certificate_template_format',
    tableName: 'certificate_template_formats',
    timestamps: true
  });
  return CertificateTemplateFormat;
};
