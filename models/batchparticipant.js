'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class batchparticipant extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.hasMany(models.payment, { foreignKey: 'participantId', as: 'payments' });
      this.belongsTo(models.batch, { foreignKey: 'batchId', as: 'batch' });
      this.belongsTo(models.user, { foreignKey: 'userId', as: 'user' });
    }
  }
  batchparticipant.init({
    batchId: DataTypes.STRING,
    userId: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'batchparticipant',
  });
  return batchparticipant;
};