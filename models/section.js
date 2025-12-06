'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class section extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.batch, { foreignKey: "batchId", as: "batch" });
      this.hasMany(models.sectionaudioinstruction, { foreignKey: "sectionId", as: "audioInstructions" });
      this.hasMany(models.group, { foreignKey: "sectionId", as: "groups" });
      this.hasMany(models.question, { foreignKey: "sectionId", as: "questions" });
      this.hasMany(models.useranswer, { foreignKey: "sectionId", as: "answers" });
    }
  }
  section.init({
    idSection: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    namaSection: DataTypes.STRING,
    deskripsi: DataTypes.TEXT,
    urutan: DataTypes.INTEGER,
    batchId: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'section',
  });
  return section;
};