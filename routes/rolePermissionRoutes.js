const express = require('express');
const router = express.Router();
const controller = require('../controllers/rolePermissionController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// Middleware Global untuk Router ini:
// 1. Harus Login
// 2. Harus punya permission 'user.manage_role'
// router.use(checkAuth);
// router.use(checkPermission('user.manage_role'));

// --- Routes Role ---
router.get('/roles', controller.getAllRoles);
router.get('/roles/:id', controller.getRoleById);
router.post('/roles', controller.createRole);
router.put('/roles/:id', controller.updateRole);
router.delete('/roles/:id', controller.deleteRole);

// --- Routes Permission ---
router.get('/permissions', controller.getAllPermissions);
router.post('/permissions', controller.createPermission);
router.put('/permissions/:id', controller.updatePermission);
router.delete('/permissions/:id', controller.deletePermission);

module.exports = router;
