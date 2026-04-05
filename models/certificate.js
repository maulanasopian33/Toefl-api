'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Certificate extends Model {
    static associate(models) {
      Certificate.belongsTo(models.user, { foreignKey: 'userId', as: 'user' });
      Certificate.belongsTo(models.userresult, { foreignKey: 'userResultId', as: 'userResult' });
    }
  }
  Certificate.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    certificateNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    /** Nama peserta (snapshot saat generate) */
    name: DataTypes.STRING,
    /** Nama batch / ujian */
    event: DataTypes.STRING,
    date: DataTypes.DATEONLY,
    score: DataTypes.INTEGER,
    qrToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    verifyUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    /** Path relatif ke file PDF di storage lokal */
    pdfUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    /** URL asli dari service eksternal (legacy, opsional) */
    externalPdfUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    /** ID batch ujian yang bersangkutan */
    batchId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    /** ID userresult spesifik yang di-generate sertifikatnya */
    userResultId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    /** ID certificate_template_format yang digunakan saat generate */
    templateFormatId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    /**
     * Snapshot data yang digunakan saat generate (audit trail).
     * Berisi: { userData, mappingData }
     */
    generated_data: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'certificate',
    tableName: 'certificates',
    timestamps: true
  });
  return Certificate;
};