'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class paymentproof extends Model {
    static associate(models) {
      // Relasi ke tabel Payment
      paymentproof.belongsTo(models.payment, { foreignKey: 'id', as: 'payment' });
    }
  }
  paymentproof.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    paymentId: DataTypes.UUID,
    imageUrl: DataTypes.STRING,
    uploadedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'paymentproof',
    tableName: 'payment_proofs'
  });
  return paymentproof;
};