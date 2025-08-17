'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class batch extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  batch.init({
    idBatch: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    namaBatch: DataTypes.STRING,
    deskripsiBatch: DataTypes.TEXT,
    tanggalMulai: DataTypes.DATE,
    tanggalSelesai: DataTypes.DATE,
    batasMaksimalPeserta: DataTypes.INTEGER,
    statusBatch: DataTypes.STRING,
    intruksiKhusus: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'batch',
  });
  return batch;
};