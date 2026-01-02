'use strict';
const {
  Model
} = require('sequelize');
const { logger } = require('../utils/logger');
module.exports = (sequelize, DataTypes) => {
  class payment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.batchparticipant, { foreignKey: 'participantId', as: 'participant' });
      this.hasMany(models.paymentproof, { foreignKey: 'paymentId', as: 'proofs' });// Relasi ke paymentproof
    }
  }
  payment.init({
      participantId: DataTypes.UUID,
      invoiceNumber: DataTypes.STRING,
      amount: DataTypes.DECIMAL,
      status: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      method: DataTypes.STRING,
      payment_proof: DataTypes.STRING,
      paid_at: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'payment',
    hooks: {
      afterCreate: (instance, options) => {
        logger.info({
          message: `Payment created with ID: ${instance.id}`,
          action: 'CREATE_PAYMENT',
          user: options.user ? options.user.email : 'system',
          details: { data: instance.toJSON() }
        });
      },
      afterUpdate: (instance, options) => {
        logger.info({
          message: `Payment updated with ID: ${instance.id}`,
          action: 'UPDATE_PAYMENT',
          user: options.user ? options.user.email : 'system',
          details: {
            paymentId: instance.id,
            updatedFields: instance.changed() || Object.keys(options.fields || {})
          }
        });
      },
      afterDestroy: (instance, options) => {
        logger.info({
          message: `Payment deleted with ID: ${instance.id}`,
          action: 'DELETE_PAYMENT',
          user: options.user ? options.user.email : 'system',
          details: { paymentId: instance.id }
        });
      }
    }
  });
  return payment;
};