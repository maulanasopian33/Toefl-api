'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class scoringtable extends Model {
        static associate(models) {
            this.hasMany(models.scoringdetail, { foreignKey: 'scoring_table_id', as: 'details' });
            this.hasMany(models.section, { foreignKey: 'scoring_table_id', as: 'sections' });
        }
    }
    scoringtable.init({
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: DataTypes.TEXT,
        is_default: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        sequelize,
        modelName: 'scoringtable',
        tableName: 'scoring_tables'
    });
    return scoringtable;
};
