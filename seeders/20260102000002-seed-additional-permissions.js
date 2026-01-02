'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const timestamp = new Date();

    // 1. Daftar Permission Tambahan
    const permissionsData = [
      { name: 'setting.update', description: 'Mengubah pengaturan aplikasi', createdAt: timestamp, updatedAt: timestamp },
      { name: 'media.upload', description: 'Mengunggah file media', createdAt: timestamp, updatedAt: timestamp },
      { name: 'media.read', description: 'Melihat daftar media', createdAt: timestamp, updatedAt: timestamp },
      { name: 'media.delete', description: 'Menghapus file media', createdAt: timestamp, updatedAt: timestamp },
      { name: 'system.view_logs', description: 'Melihat log sistem', createdAt: timestamp, updatedAt: timestamp },
      { name: 'result.view_all', description: 'Melihat semua hasil ujian peserta', createdAt: timestamp, updatedAt: timestamp },
      { name: 'batch.read', description: 'Melihat detail/riwayat batch', createdAt: timestamp, updatedAt: timestamp },
      { name: 'test.submit', description: 'Mengirim jawaban ujian', createdAt: timestamp, updatedAt: timestamp },
    ];

    // Insert Permissions (ignoreDuplicates agar aman dijalankan berulang)
    await queryInterface.bulkInsert('permissions', permissionsData, { 
      updateOnDuplicate: ['description', 'updatedAt'] 
    });

    // 2. Ambil ID Role dan Permission dari Database
    const roles = await queryInterface.sequelize.query(
      `SELECT id, name FROM roles;`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const permissions = await queryInterface.sequelize.query(
      `SELECT id, name FROM permissions WHERE name IN (:names);`,
      { 
        replacements: { names: permissionsData.map(p => p.name) },
        type: queryInterface.sequelize.QueryTypes.SELECT 
      }
    );

    const roleMap = {};
    roles.forEach(r => roleMap[r.name] = r.id);

    const permMap = {};
    permissions.forEach(p => permMap[p.name] = p.id);

    const rolePermissions = [];

    // 3. Mapping Permission ke Role ADMIN (Dapat SEMUA permission baru)
    if (roleMap['admin']) {
      permissions.forEach(p => {
        rolePermissions.push({
          roleId: roleMap['admin'],
          permissionId: p.id
        });
      });
    }

    // 4. Mapping Permission ke Role USER (Hanya permission tertentu)
    // User butuh 'batch.read' untuk melihat history ujian (sesuai examRoutes.js)
    if (roleMap['user']) {
      const userSpecificPermissions = ['batch.read', 'media.read', 'test.submit'];
      userSpecificPermissions.forEach(pName => {
        if (permMap[pName]) {
          rolePermissions.push({
            roleId: roleMap['user'],
            permissionId: permMap[pName]
          });
        }
      });
    }

    // 5. Insert ke tabel pivot role_permissions
    if (rolePermissions.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rolePermissions, { ignoreDuplicates: true });
    }
  },

  async down (queryInterface, Sequelize) {
    const permissionNames = [
      'setting.update', 'media.upload', 'media.read', 'media.delete',
      'system.view_logs', 'result.view_all', 'batch.read', 'test.submit'
    ];

    // Ambil ID permission yang akan dihapus
    const permissions = await queryInterface.sequelize.query(
      `SELECT id FROM permissions WHERE name IN (:names);`,
      { replacements: { names: permissionNames }, type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const permissionIds = permissions.map(p => p.id);

    if (permissionIds.length > 0) {
      await queryInterface.bulkDelete('role_permissions', { permissionId: permissionIds });
      await queryInterface.bulkDelete('permissions', { id: permissionIds });
    }
  }
};