const db = require('../models');
const { sequelize } = require('../models');

module.exports = {
  // --- ROLE MANAGEMENT ---

  // Mendapatkan semua role beserta permission-nya
  async getAllRoles(req, res, next) {
    try {
      const roles = await db.role.findAll({
        include: [{
          model: db.permission,
          as: 'permissions',
          through: { attributes: [] } // Sembunyikan atribut tabel pivot
        }],
        order: [['id', 'ASC']]
      });
      res.status(200).json({ status: true, data: roles });
    } catch (error) {
      next(error);
    }
  },

  // Mendapatkan detail satu role
  async getRoleById(req, res, next) {
    try {
      const { id } = req.params;
      const role = await db.role.findByPk(id, {
        include: [{
          model: db.permission,
          as: 'permissions',
          through: { attributes: [] }
        }]
      });

      if (!role) return res.status(404).json({ status: false, message: 'Role tidak ditemukan.' });

      res.status(200).json({ status: true, data: role });
    } catch (error) {
      next(error);
    }
  },

  // Membuat role baru
  async createRole(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const { name, description, permissions } = req.body; // permissions: array of permission IDs (integer)

      // Validasi nama role unik
      const existingRole = await db.role.findOne({ where: { name } });
      if (existingRole) {
        await t.rollback();
        return res.status(400).json({ status: false, message: 'Nama role sudah digunakan.' });
      }

      const newRole = await db.role.create({ name, description }, { transaction: t });

      if (permissions && Array.isArray(permissions) && permissions.length > 0) {
        // Assign permissions ke role baru
        await newRole.setPermissions(permissions, { transaction: t });
      }

      await t.commit();
      
      // Fetch ulang untuk mengembalikan data lengkap dengan permissions
      const roleWithPerms = await db.role.findByPk(newRole.id, {
        include: [{ model: db.permission, as: 'permissions', through: { attributes: [] } }]
      });

      res.status(201).json({ status: true, message: 'Role berhasil dibuat.', data: roleWithPerms });
    } catch (error) {
      await t.rollback();
      next(error);
    }
  },

  // Mengupdate role dan permission-nya
  async updateRole(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { name, description, permissions } = req.body;

      const role = await db.role.findByPk(id);
      if (!role) {
        await t.rollback();
        return res.status(404).json({ status: false, message: 'Role tidak ditemukan.' });
      }

      // Proteksi: Jangan ubah nama role 'admin' atau 'user' untuk mencegah sistem crash
      if (['admin', 'user'].includes(role.name) && name && name !== role.name) {
         await t.rollback();
         return res.status(400).json({ status: false, message: 'Nama role default sistem (admin/user) tidak boleh diubah.' });
      }

      await role.update({ name, description }, { transaction: t });

      // Jika array permissions dikirim, update relasi (replace existing)
      if (permissions && Array.isArray(permissions)) {
        await role.setPermissions(permissions, { transaction: t });
      }

      await t.commit();

      const updatedRole = await db.role.findByPk(id, {
        include: [{ model: db.permission, as: 'permissions', through: { attributes: [] } }]
      });

      res.status(200).json({ status: true, message: 'Role berhasil diperbarui.', data: updatedRole });
    } catch (error) {
      await t.rollback();
      next(error);
    }
  },

  // Menghapus role
  async deleteRole(req, res, next) {
    try {
      const { id } = req.params;
      const role = await db.role.findByPk(id);

      if (!role) return res.status(404).json({ status: false, message: 'Role tidak ditemukan.' });
      
      // Proteksi: Jangan hapus role default
      if (['admin', 'user'].includes(role.name)) {
        return res.status(400).json({ status: false, message: 'Role default sistem tidak boleh dihapus.' });
      }

      await role.destroy();
      res.status(200).json({ status: true, message: 'Role berhasil dihapus.' });
    } catch (error) {
      next(error);
    }
  },

  // --- PERMISSION MANAGEMENT ---

  // Mendapatkan semua permission yang tersedia
  async getAllPermissions(req, res, next) {
    try {
      const permissions = await db.permission.findAll({
        order: [['name', 'ASC']]
      });
      res.status(200).json({ status: true, data: permissions });
    } catch (error) {
      next(error);
    }
  },

  // Membuat permission baru (Advanced)
  async createPermission(req, res, next) {
    try {
      const { name, description } = req.body;
      
      const existing = await db.permission.findOne({ where: { name } });
      if (existing) {
        return res.status(400).json({ status: false, message: 'Permission sudah ada.' });
      }

      const newPerm = await db.permission.create({ name, description });
      res.status(201).json({ status: true, message: 'Permission berhasil dibuat.', data: newPerm });
    } catch (error) {
      next(error);
    }
  },

  // Update permission
  async updatePermission(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const perm = await db.permission.findByPk(id);
      
      if (!perm) return res.status(404).json({ status: false, message: 'Permission tidak ditemukan.' });

      await perm.update({ name, description });
      res.status(200).json({ status: true, message: 'Permission berhasil diperbarui.', data: perm });
    } catch (error) {
      next(error);
    }
  },

  // Hapus permission
  async deletePermission(req, res, next) {
    try {
      const { id } = req.params;
      const perm = await db.permission.findByPk(id);
      if (!perm) return res.status(404).json({ status: false, message: 'Permission tidak ditemukan.' });

      await perm.destroy();
      res.status(200).json({ status: true, message: 'Permission berhasil dihapus.' });
    } catch (error) {
      next(error);
    }
  }
};
