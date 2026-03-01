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
      this.hasMany(models.userresult, { foreignKey: "batchId", as: "results" });
      this.hasMany(models.useranswer, { foreignKey: "batchId", as: "answers" });
      this.hasMany(models.batchsession, { foreignKey: "batch_id", as: "sessions" });
      this.belongsTo(models.user, { foreignKey: "created_by", as: "creator" });
    }
  }
  batch.init({
    idBatch: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    name: DataTypes.STRING,
    description: DataTypes.TEXT,
    type: {
      type: DataTypes.ENUM('PREP_CLASS', 'TRYOUT_ONLY', 'FULL_PACKAGE'),
      defaultValue: 'PREP_CLASS'
    },
    start_date: DataTypes.DATE,
    end_date: DataTypes.DATE,
    registration_open_at: DataTypes.DATE,
    registration_close_at: DataTypes.DATE,
    max_participants: DataTypes.INTEGER,
    min_participants: DataTypes.INTEGER,
    status: {
      type: DataTypes.ENUM('DRAFT', 'OPEN', 'CLOSED', 'RUNNING', 'FINISHED', 'CANCELLED'),
      defaultValue: 'DRAFT'
    },
    price: {
      type: DataTypes.INTEGER,
      comment: 'Harga dalam Rupiah tanpa desimal'
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'IDR'
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      comment: 'Total durasi program dalam menit'
    },
    special_instructions: DataTypes.TEXT,
    created_by: DataTypes.STRING, // FK to user.uid
    scoring_type: {
      type: DataTypes.ENUM('SCALE', 'RAW'),
      defaultValue: 'SCALE'
    },
    scoring_config: {
      type: DataTypes.JSON,
      comment: 'Configuration for scoring, e.g., initial value for RAW type'
    }
  }, {
    sequelize,
    modelName: 'batch',
    paranoid: true, // Enable soft deletes
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