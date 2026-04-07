'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the foreign key constraint that binds section_category to sections.idSection
    // because we have moved to generic category slugs ('listening', 'reading', etc.)
    try {
      await queryInterface.removeConstraint('scoring_details', 'fk_scoring_details_section');
    } catch (err) {
      console.warn('Constraint fk_scoring_details_section not found, skipping removal.');
    }
  },

  async down(queryInterface, Sequelize) {
    // Re-add the constraint if we need to rollback (might fail if data is already strings)
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
  }
};
