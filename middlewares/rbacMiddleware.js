const db = require('../models');

/**
 * Middleware untuk mengecek permission user secara dinamis.
 * Gunakan middleware ini di route definition.
 * Contoh: router.get('/', authMiddleware, checkPermission('payment.view_all'), controller.getAll);
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // Pastikan user sudah terautentikasi (req.user harus ada dari auth middleware sebelumnya)
      if (!req.user || !req.user.uid) {
        return res.status(401).json({ status: false, message: 'Unauthorized: User tidak ditemukan.' });
      }

      // Ambil data user beserta role dan permissions dari database
      const user = await db.user.findByPk(req.user.uid, {
        include: [
          {
            model: db.role,
            as: 'role',
            include: [
              {
                model: db.permission,
                as: 'permissions',
                through: { attributes: [] } // Hide pivot table attributes
              }
            ]
          }
        ]
      });

      if (!user || !user.role) {
        return res.status(403).json({ status: false, message: 'Forbidden: User tidak memiliki role yang valid.' });
      }

      // Mapping permission ke array string
      const permissions = user.role.permissions.map(p => p.name);
      
      // Attach ke req.user agar bisa dipakai di controller
      req.user.roleName = user.role.name;
      req.user.permissions = permissions;

      // Cek apakah user memiliki permission yang dibutuhkan
      if (requiredPermission && !permissions.includes(requiredPermission)) {
        return res.status(403).json({ status: false, message: `Forbidden: Anda tidak memiliki izin '${requiredPermission}'.` });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { checkPermission };