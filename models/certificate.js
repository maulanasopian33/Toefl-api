'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Certificate extends Model {
    static associate(models) {
      // Hubungkan dengan User jika diperlukan
      Certificate.belongsTo(models.user, { foreignKey: 'userId', as: 'user' });
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
    name: DataTypes.STRING,
    event: DataTypes.STRING,
    date: DataTypes.DATEONLY,
    score: DataTypes.INTEGER,
    qrToken: DataTypes.STRING,
    verifyUrl: DataTypes.STRING,
    pdfUrl: DataTypes.STRING, // Lokasi file di storage lokal
    externalPdfUrl: DataTypes.STRING // URL asli dari service Python (opsional)
  }, {
    sequelize,
    modelName: 'certificate',
    tableName: 'certificates',
    timestamps: true
  });
  return Certificate;
};