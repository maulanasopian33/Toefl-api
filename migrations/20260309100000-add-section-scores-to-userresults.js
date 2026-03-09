'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('userresults', 'section_scores', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'JSON object: { "Listening": 55, "Structure": 50, "Reading": 47 }. Stored at calculation time.'
    });
    await queryInterface.addColumn('userresults', 'cefr_level', {
      type: Sequelize.ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2'),
      allowNull: true,
      defaultValue: null,
      comment: 'CEFR level mapped from total score at calculation time.'
    });
    await queryInterface.addColumn('userresults', 'passed', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      comment: 'Whether the participant passed based on batch passing_score threshold. NULL if no threshold is set.'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('userresults', 'section_scores');
    await queryInterface.removeColumn('userresults', 'passed');
    // ENUM removal requires dropping the type too
    await queryInterface.removeColumn('userresults', 'cefr_level');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS `enum_userresults_cefr_level`;").catch(() => {});
  }
};
