'use strict';
const {
  Model
} = require('sequelize');
const { logger } = require('../utils/logger');
module.exports = (sequelize, DataTypes) => {
  class media extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  media.init({
    filename: DataTypes.STRING,
    originalName: DataTypes.STRING,
    mimeType: DataTypes.STRING,
    size: DataTypes.INTEGER,
    url: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'media',
    hooks: {
      afterCreate: (instance, options) => {
        logger.info({
          message: `Media file uploaded: ${instance.originalName}`,
          action: 'UPLOAD_MEDIA',
          user: options.user ? options.user.email : 'system',
          details: {
            mediaId: instance.id,
            filename: instance.filename,
            data: instance.toJSON()
          }
        });
      },
      afterDestroy: (instance, options) => {
        logger.info({
          message: `Media file deleted: ${instance.originalName}`,
          action: 'DELETE_MEDIA',
          user: options.user ? options.user.email : 'system',
          details: {
            mediaId: instance.id,
            filename: instance.filename
          }
        });
      }
      // No update hook as there is no update endpoint
    }
  });
  return media;
};