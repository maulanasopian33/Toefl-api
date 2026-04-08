'use strict';

/**
 * Migration: Fix collation mismatch on debug_logs table.
 * Error: "Illegal mix of collations (utf8mb4_general_ci,IMPLICIT) and (utf8mb4_unicode_ci,IMPLICIT) for operation '='"
 * Cause: debug_logs uses utf8mb4_unicode_ci (standard) but users table uses utf8mb4_general_ci.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE debug_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE debug_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  }
};
