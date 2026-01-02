'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class rolepermission extends Model {
    static associate(models) {
      // Junction table
    }
  }
  rolepermission.init({
    roleId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'roles',
        key: 'id'
      }
    },
    permissionId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'permissions',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'rolepermission',
    tableName: 'role_permissions',
    timestamps: false
  });
  return rolepermission;
};