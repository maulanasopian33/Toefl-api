'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class permission extends Model {
    static associate(models) {
      // Relasi ke Role (Many-to-Many)
      permission.belongsToMany(models.role, {
        through: 'rolepermission',
        as: 'roles',
        foreignKey: 'permissionId',
        otherKey: 'roleId'
      });
    }
  }
  permission.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'permission',
  });
  return permission;
};