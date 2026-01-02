'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class role extends Model {
    static associate(models) {
      // Relasi ke User (One-to-Many)
      // Pastikan model User memiliki kolom roleId
      if (models.user) {
        this.hasMany(models.user, { foreignKey: 'roleId', as: 'users' });
      }
      
      // Relasi ke Permission (Many-to-Many)
      this.belongsToMany(models.permission, {
        through: 'rolepermission',
        as: 'permissions',
        foreignKey: 'roleId',
        otherKey: 'permissionId'
      });
    }
  }
  role.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'role',
  });
  return role;
};