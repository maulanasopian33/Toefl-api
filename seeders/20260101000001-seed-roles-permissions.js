'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const timestamp = new Date();

    // 1. Daftar Permission yang akan dibuat
    const permissionsData = [
      { name: 'payment.view_all', description: 'Melihat semua data pembayaran', createdAt: timestamp, updatedAt: timestamp },
      { name: 'payment.view_self', description: 'Melihat data pembayaran sendiri', createdAt: timestamp, updatedAt: timestamp },
      { name: 'payment.create', description: 'Membuat pembayaran baru', createdAt: timestamp, updatedAt: timestamp },
      { name: 'payment.update', description: 'Memperbarui status pembayaran', createdAt: timestamp, updatedAt: timestamp },
      { name: 'batch.create', description: 'Membuat batch ujian baru', createdAt: timestamp, updatedAt: timestamp },
      { name: 'batch.update', description: 'Mengedit data batch', createdAt: timestamp, updatedAt: timestamp },
      { name: 'batch.delete', description: 'Menghapus batch', createdAt: timestamp, updatedAt: timestamp },
      { name: 'user.view_all', description: 'Melihat daftar user', createdAt: timestamp, updatedAt: timestamp },
      { name: 'user.manage_role', description: 'Mengubah role user', createdAt: timestamp, updatedAt: timestamp },
    ];

    // Insert Permissions (ignoreDuplicates agar aman dijalankan berulang)
    await queryInterface.bulkInsert('permissions', permissionsData, { 
      updateOnDuplicate: ['description', 'updatedAt'] 
    });

    // 2. Daftar Role yang akan dibuat
    const rolesData = [
      { name: 'admin', description: 'Administrator dengan akses penuh', createdAt: timestamp, updatedAt: timestamp },
      { name: 'user', description: 'Pengguna standar', createdAt: timestamp, updatedAt: timestamp },
    ];

    await queryInterface.bulkInsert('roles', rolesData, { 
      updateOnDuplicate: ['description', 'updatedAt'] 
    });

    // 3. Mapping Permission ke Role
    // Ambil ID dari database karena ID biasanya auto-increment
    const roles = await queryInterface.sequelize.query(
      `SELECT id, name FROM roles;`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const permissions = await queryInterface.sequelize.query(
      `SELECT id, name FROM permissions;`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const roleMap = {};
    roles.forEach(r => roleMap[r.name] = r.id);

    const permMap = {};
    permissions.forEach(p => permMap[p.name] = p.id);

    const rolePermissions = [];

    // -- Setup Role: ADMIN (Mendapatkan SEMUA permission) --
    if (roleMap['admin']) {
      permissions.forEach(p => {
        rolePermissions.push({
          roleId: roleMap['admin'],
          permissionId: p.id
        });
      });
    }

    // -- Setup Role: USER (Mendapatkan permission terbatas) --
    if (roleMap['user']) {
      const userPermissions = ['payment.view_self', 'payment.create']; // Tentukan permission khusus user
      userPermissions.forEach(pName => {
        if (permMap[pName]) {
          rolePermissions.push({
            roleId: roleMap['user'],
            permissionId: permMap[pName]
          });
        }
      });
    }

    // Insert ke tabel pivot role_permissions
    // Catatan: Tabel pivot biasanya tidak punya createdAt/updatedAt jika timestamps: false di model
    if (rolePermissions.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rolePermissions, { ignoreDuplicates: true });
    }
  },

  async down (queryInterface, Sequelize) {
    // Hapus data saat rollback (urutan penting untuk menghindari constraint error)
    await queryInterface.bulkDelete('role_permissions', null, {});
    await queryInterface.bulkDelete('roles', null, {});
    await queryInterface.bulkDelete('permissions', null, {});
  }
};