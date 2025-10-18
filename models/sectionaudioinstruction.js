'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class sectionAudioInstruction extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.section, { foreignKey: "sectionId", as: "section" });
    }
  }
  sectionAudioInstruction.init({
    sectionId: DataTypes.STRING,
    audioUrl: DataTypes.STRING,
    description: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'sectionAudioInstruction',
  });
  return sectionAudioInstruction;
};