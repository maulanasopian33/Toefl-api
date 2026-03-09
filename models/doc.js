'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Doc extends Model {
    static associate(models) {
      // No associations needed
    }
  }

  Doc.init({
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Umum'
    },
    category_icon: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'lucide:book-open'
    },
    content_md: {
      type: DataTypes.TEXT('long'),
      allowNull: true
    },
    order_num: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'doc',
    tableName: 'docs',
    timestamps: true
  });

  return Doc;
};
