'use strict';
const {
  Model
} = require('sequelize');
const { logger } = require('../utils/logger');
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
    hooks: {
      afterCreate: (instance, options) => {
        logger.info({
          message: `User detail created for UID: ${instance.uid}`,
          action: 'CREATE_USER_DETAIL',
          user: options.user ? options.user.email : 'system',
          details: { data: instance.toJSON() }
        });
      },
      afterUpdate: (instance, options) => {
        logger.info({
          message: `User detail updated for UID: ${instance.uid}`,
          action: 'UPDATE_USER_DETAIL',
          user: options.user ? options.user.email : 'system',
          details: {
            uid: instance.uid,
            updatedFields: instance.changed() || Object.keys(options.fields || {})
          }
        });
      },
      afterDestroy: (instance, options) => {
        logger.info({
          message: `User detail deleted for UID: ${instance.uid}`,
          action: 'DELETE_USER_DETAIL',
          user: options.user ? options.user.email : 'system',
          details: { uid: instance.uid }
        });
      }
    }
  });
  return detailuser;
};