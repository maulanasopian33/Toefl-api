'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      // define association here
      AuditLog.belongsTo(models.user, {
        foreignKey: 'userId',
        as: 'user'
      });
    }
  }
  AuditLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    module: {
      type: DataTypes.STRING,
      allowNull: false
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    source: {
      type: DataTypes.ENUM('backend', 'frontend'),
      allowNull: false,
      defaultValue: 'backend'
    }
  }, {
    sequelize,
    modelName: 'auditlog',
    tableName: 'audit_logs',
    underscored: false,
  });
  return AuditLog;
};
