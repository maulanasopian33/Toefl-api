'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Cek deskripsi tabel untuk memastikan kolom 'role' ada sebelum mencoba memprosesnya
    const tableInfo = await queryInterface.describeTable('users');

    if (tableInfo.role) {
      // 1. Migrasi Data: Pindahkan data dari kolom 'role' (string) ke 'roleId' (integer)
      
      // Ambil mapping Role ID dari tabel roles
      const [roles] = await queryInterface.sequelize.query("SELECT id, name FROM roles");
      const roleMap = {};
      roles.forEach(r => roleMap[r.name] = r.id);

      // Ambil semua user
      const [users] = await queryInterface.sequelize.query("SELECT uid, role FROM users");

      // Loop update setiap user
      for (const user of users) {
        const oldRoleString = user.role || 'user'; // Default ke 'user' jika null
        let newRoleId = roleMap[oldRoleString];

        // Jika role string tidak ditemukan di tabel roles (misal data lama tidak valid), fallback ke role 'user'
        if (!newRoleId && roleMap['user']) {
          newRoleId = roleMap['user'];
        }

        if (newRoleId) {
          await queryInterface.sequelize.query(
            `UPDATE users SET roleId = ${newRoleId} WHERE uid = '${user.uid}'`
          );
        }
      }

      // 2. Hapus kolom 'role' yang lama
      await queryInterface.removeColumn('users', 'role');
    }
  },

  async down(queryInterface, Sequelize) {
    // 1. Buat kembali kolom 'role'
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.STRING,
      defaultValue: 'user'
    });

    // 2. Isi kembali data kolom 'role' berdasarkan 'roleId'
    const [users] = await queryInterface.sequelize.query("SELECT uid, roleId FROM users");
    const [roles] = await queryInterface.sequelize.query("SELECT id, name FROM roles");
    const roleMap = {};
    roles.forEach(r => roleMap[r.id] = r.name);

    for (const user of users) {
      if (user.roleId && roleMap[user.roleId]) {
        await queryInterface.sequelize.query(
          `UPDATE users SET role = '${roleMap[user.roleId]}' WHERE uid = '${user.uid}'`
        );
      }
    }
  }
};