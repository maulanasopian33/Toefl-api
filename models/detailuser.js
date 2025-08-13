'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class detailuser extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      detailuser.belongsTo(models.user, { foreignKey : 'uid' })
      // define association here
    }
  }
  detailuser.init({
    uid: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    namaLengkap: DataTypes.STRING,
    nim: DataTypes.STRING,
    fakultas: DataTypes.STRING,
    prodi: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'detailuser',
  });
  return detailuser;
};