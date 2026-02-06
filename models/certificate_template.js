'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CertificateTemplate extends Model {
    static associate(models) {
      CertificateTemplate.hasMany(models.certificate_template_format, {
        foreignKey: 'templateId',
        as: 'formats',
        onDelete: 'CASCADE'
      });
    }
  }
  CertificateTemplate.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'certificate_template',
    tableName: 'certificate_templates',
    timestamps: true
  });
  return CertificateTemplate;
};
