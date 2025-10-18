'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class groupAudioInstruction extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.group, { foreignKey: "groupId", as: "group" });
    }
  }
  groupAudioInstruction.init({
    groupId: DataTypes.STRING,
    audioUrl: DataTypes.STRING,
    description: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'groupAudioInstruction',
  });
  return groupAudioInstruction;
};