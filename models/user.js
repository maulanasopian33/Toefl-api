'use strict';
const {
  Model
} = require('sequelize');
const { logger } = require('../utils/logger');
module.exports = (sequelize, DataTypes) => {
  class user extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      user.hasOne(models.detailuser, { foreignKey : 'uid' })
      if (models.role) {
        user.belongsTo(models.role, { foreignKey: 'roleId', as: 'role' });
      }
    }
  }
  user.init({
    uid: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // Email harus unik
      validate: {
        isEmail: true, // Memastikan formatnya adalah email
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    picture: {
      type: DataTypes.STRING,
      allowNull: true
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: false
      // You can set a default value here or in the controller
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'user',
    hooks: {
      afterCreate: (instance, options) => {
        // The login controller handles the 'USER_CREATED' log,
        // as it has more context (login vs registration).
        // This hook is for other creation paths if any.
        logger.info({
          message: `User account created: ${instance.email}`,
          action: 'CREATE_USER',
          user: options.user ? options.user.email : 'system',
          details: { uid: instance.uid }
        });
      },
      afterUpdate: (instance, options) => {
        // The login controller handles the 'USER_LOGIN' log.
        // This hook will catch other updates, e.g., role change by an admin.
        logger.info({
          message: `User account updated: ${instance.email}`,
          action: 'UPDATE_USER',
          user: options.user ? options.user.email : 'system',
          details: {
            uid: instance.uid,
            updatedFields: instance.changed() || Object.keys(options.fields || {})
          }
        });
      }
    }
  });
  return user;
};