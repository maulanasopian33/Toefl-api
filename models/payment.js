'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class payment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.batchParticipant, { foreignKey: 'participantId', as: 'participant' });
    }
  }
  payment.init({
      participantId: DataTypes.UUID,
      amount: DataTypes.DECIMAL,
      status: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      method: DataTypes.STRING,
      payment_proof: DataTypes.STRING,
      paid_at: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'payment',
  });
  return payment;
};