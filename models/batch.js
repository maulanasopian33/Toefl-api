'use strict';
const {
  Model
} = require('sequelize'); 
const { logger } = require('../utils/logger');
module.exports = (sequelize, DataTypes) => {
  class batch extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.hasMany(models.batchparticipant, { foreignKey: 'batchId', as: 'participants' });
      this.hasMany(models.section, { foreignKey: "batchId", as: "sections" });
      this.hasMany(models.group, { foreignKey: "batchId", as: "groups" });
      this.hasMany(models.userResult, { foreignKey: "batchId", as: "results" });
      this.hasMany(models.userAnswer, { foreignKey: "batchId", as: "answers" });
    }
  }
  batch.init({
    idBatch: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    namaBatch: DataTypes.STRING,
    price: DataTypes.DECIMAL,
    deskripsiBatch: DataTypes.TEXT,
    tanggalMulai: DataTypes.DATE,
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3600, // dalam detik (contoh: 1 jam)
      comment: 'Durasi ujian dalam detik'
    },
    tanggalSelesai: DataTypes.DATE,
    batasMaksimalPeserta: DataTypes.INTEGER,
    statusBatch: DataTypes.STRING,
    intruksiKhusus: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'batch', 
    hooks: {
      afterCreate: (instance, options) => {
        logger.info({
          message: `Batch created with ID: ${instance.idBatch}`,
          action: 'CREATE_BATCH',
          user: options.user ? options.user.email : 'system',
          details: {
            data: instance.toJSON()
          }
        });
      },
      afterUpdate: (instance, options) => {
        logger.info({
          message: `Batch updated with ID: ${instance.idBatch}`,
          action: 'UPDATE_BATCH',
          user: options.user ? options.user.email : 'system',
          details: {
            batchId: instance.idBatch,
            updatedFields: instance.changed() || Object.keys(options.fields)
          }
        });
      },
      afterDestroy: (instance, options) => {
        logger.info({
          message: `Batch deleted with ID: ${instance.idBatch}`,
          action: 'DELETE_BATCH',
          user: options.user ? options.user.email : 'system',
          details: { batchId: instance.idBatch }
        });
      }
    }
  });
  return batch;
};