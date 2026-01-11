'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Create scoring_tables
        await queryInterface.createTable('scoring_tables', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });

        // 2. Create scoring_details
        await queryInterface.createTable('scoring_details', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            scoring_table_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'scoring_tables',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            section_category: {
                type: Sequelize.STRING, // listening, structure, reading, etc.
                allowNull: false
            },
            correct_count: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            converted_score: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });

        // Add index for faster lookup
        await queryInterface.addIndex('scoring_details', ['scoring_table_id', 'section_category', 'correct_count'], {
            unique: true,
            name: 'idx_scoring_lookup'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('scoring_details');
        await queryInterface.dropTable('scoring_tables');
    }
};
