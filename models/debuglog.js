'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class debuglog extends Model {
    static associate(models) {
      // Relasi ke user menggunakan UID (Firebase)
      if (models.user) {
        debuglog.belongsTo(models.user, { foreignKey: 'userId', targetKey: 'uid', as: 'user' });
      }
    }
  }
  debuglog.init({
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    level: {
      type: DataTypes.ENUM('INFO', 'DEBUG', 'WARN', 'ERROR'),
      defaultValue: 'DEBUG'
    },
    context: {
      type: DataTypes.JSON,
      allowNull: true
    },
    source: {
      type: DataTypes.ENUM('FE', 'BE'),
      defaultValue: 'BE'
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'debuglog',
    tableName: 'debug_logs',
  });
  return debuglog;
};
