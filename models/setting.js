'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class setting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  setting.init({
    nama_aplikasi: DataTypes.STRING,
    nama_pendek: DataTypes.STRING,
    tagline: DataTypes.STRING,
    deskripsi_singkat: DataTypes.TEXT,
    id_aplikasi: DataTypes.STRING,
    logo_app: DataTypes.STRING,
    favicon: DataTypes.STRING,
    warna_utama: DataTypes.STRING,
    mode_tampilan: DataTypes.STRING,
    nama_organisasi: DataTypes.STRING,
    email_support: DataTypes.STRING,
    website: DataTypes.STRING,
    no_kontak: DataTypes.STRING,
    bahasa_default: DataTypes.STRING,
    zona_waktu: DataTypes.STRING,
    mata_uang: DataTypes.STRING,
    hero_title: DataTypes.STRING,
    hero_subtitle: DataTypes.TEXT,
    payment_instructions_bank: DataTypes.TEXT,
    payment_instructions_offline: DataTypes.TEXT,
    payment_offline_details: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'setting',
    hooks: {
      // Anda bisa menambahkan hooks jika diperlukan
    }
  });
  return setting;
};