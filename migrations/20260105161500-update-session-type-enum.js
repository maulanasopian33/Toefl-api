'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            // Modifying ENUM in MySQL usually requires raw query or changeColumn.
            // Since it's an ENUM, we expand the allowed values.

            // We will use changeColumn to update the definition
            await queryInterface.changeColumn('batchsessions', 'session_type', {
                type: Sequelize.ENUM('CLASS', 'TRYOUT', 'DISCUSSION', 'CONSULTATION'),
                defaultValue: 'CLASS',
                allowNull: true // Keeping consistency, though usually ENUMs can be non-null with default
            }, { transaction });

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            // CAUTION: Reverting this will cause data loss or truncation if there are 'CONSULTATION' values.
            // We are just restoring the schema definition.
            await queryInterface.changeColumn('batchsessions', 'session_type', {
                type: Sequelize.ENUM('CLASS', 'TRYOUT', 'DISCUSSION'),
                defaultValue: 'CLASS',
                allowNull: true
            }, { transaction });

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }
};
