'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Menambahkan FK constraint antara scoring_details(section_category) dan sections(idSection)
        await queryInterface.addConstraint('scoring_details', {
            fields: ['section_category'],
            type: 'foreign key',
            name: 'fk_scoring_details_section',
            references: {
                table: 'sections',
                field: 'idSection'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeConstraint('scoring_details', 'fk_scoring_details_section');
    }
};
