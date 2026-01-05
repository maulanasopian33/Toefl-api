'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class batchsession extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.batch, { foreignKey: 'batch_id', as: 'batch' });
      this.belongsTo(models.user, { foreignKey: 'trainer_id', as: 'trainer' });
    }
  }
  batchsession.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    batch_id: DataTypes.STRING,
    title: DataTypes.STRING,
    session_type: {
      type: DataTypes.ENUM('CLASS', 'TRYOUT', 'DISCUSSION', 'CONSULTATION'),
      defaultValue: 'CLASS'
    },
    start_at: DataTypes.DATE,
    end_at: DataTypes.DATE,
    meeting_url: DataTypes.STRING,
    trainer_id: DataTypes.STRING, // FK users
    capacity: DataTypes.INTEGER,
    notes: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'batchsession',
    indexes: [
      { fields: ['batch_id', 'start_at'] }
    ]
  });
  return batchsession;
};