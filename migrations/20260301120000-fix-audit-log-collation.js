'use strict';

/**
 * Migration: Fix collation mismatch on audit_logs table.
 *
 * Error: "Illegal mix of collations (utf8mb4_general_ci,IMPLICIT) and
 *         (utf8mb4_unicode_ci,IMPLICIT) for operation '='"
 *
 * Root cause: audit_logs dibuat dengan collation default MySQL (utf8mb4_unicode_ci)
 * sementara tabel users menggunakan utf8mb4_general_ci.
 * Query yang melakukan JOIN/INCLUDE antara keduanya menjadi gagal karena
 * MySQL tidak bisa membandingkan string dengan collation berbeda secara implisit.
 *
 * Fix: Ubah seluruh tabel audit_logs ke utf8mb4_general_ci agar sesuai.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ubah collation tabel
    await queryInterface.sequelize.query(
      `ALTER TABLE audit_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Kembalikan ke unicode_ci jika perlu rollback
    await queryInterface.sequelize.query(
      `ALTER TABLE audit_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  }
};
