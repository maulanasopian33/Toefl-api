'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class question extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.group, { foreignKey: "groupId", as: "group" });
      this.belongsTo(models.section, { foreignKey: "sectionId", as: "section" });
      this.hasMany(models.option, { foreignKey: "questionId", as: "options" });
      this.hasMany(models.useranswer, { foreignKey: "questionId", as: "answers" });
    }
  }
  question.init({
    idQuestion:{ 
      type : DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    text: DataTypes.TEXT,
    type: DataTypes.STRING,
    groupId: DataTypes.STRING,
    sectionId: DataTypes.STRING,
    audioUrl: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'question',
  });
  return question;
};