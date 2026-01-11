'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class scoringdetail extends Model {
        static associate(models) {
            this.belongsTo(models.scoringtable, { foreignKey: 'scoring_table_id', as: 'table' });
            this.belongsTo(models.section, { foreignKey: 'section_category', targetKey: 'idSection', as: 'section' });
        }
    }
    scoringdetail.init({
        scoring_table_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        section_category: {
            type: DataTypes.STRING,
            allowNull: false
        },
        correct_count: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        converted_score: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'scoringdetail',
        tableName: 'scoring_details'
    });
    return scoringdetail;
};
