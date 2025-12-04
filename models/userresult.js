'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class userResult extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.batch, { foreignKey: "batchId",targetKey: 'idBatch', as: "batch" });
      this.belongsTo(models.user, { foreignKey: "userId", targetKey: 'uid', as: 'user' });
    }
  }
  userResult.init({
    userId: DataTypes.STRING,
    batchId: DataTypes.STRING,
    totalQuestions: DataTypes.INTEGER,
    correctCount: DataTypes.INTEGER,
    wrongCount: DataTypes.INTEGER,
    score: DataTypes.INTEGER,
    submittedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'userResult',
  });
  return userResult;
};