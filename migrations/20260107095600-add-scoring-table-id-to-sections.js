'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('sections', 'scoring_table_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'scoring_tables',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('sections', 'scoring_table_id');
    }
};
