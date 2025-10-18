'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class group extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.batch, { foreignKey: "batchId", as: "batch" });
      this.belongsTo(models.section, { foreignKey: "sectionId", as: "section" });
      this.hasMany(models.groupAudioInstruction, { foreignKey: "groupId", as: "audioInstructions" });
      this.hasMany(models.question, { foreignKey: "groupId", as: "questions" });
    }
  }
  group.init({
    idGroup: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    passage: DataTypes.TEXT,
    batchId: DataTypes.STRING,
    sectionId: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'group',
  });
  return group;
};