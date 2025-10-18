'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class option extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.question, { foreignKey: "questionId", as: "question" });
    }
  }
  option.init({
    idOption: {
      type : DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    questionId: DataTypes.STRING,
    text: DataTypes.STRING,
    isCorrect: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'option',
  });
  return option;
};