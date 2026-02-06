'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CertificateTemplateFormat extends Model {
    static associate(models) {
      CertificateTemplateFormat.belongsTo(models.certificate_template, {
        foreignKey: 'templateId',
        as: 'template'
      });
    }
  }
  CertificateTemplateFormat.init({
    templateId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    file_docx: {
      type: DataTypes.STRING,
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'certificate_template_format',
    tableName: 'certificate_template_formats',
    timestamps: true
  });
  return CertificateTemplateFormat;
};
