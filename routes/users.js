const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');


const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');
/* GET users listing. */
router.get('/', checkAuth, checkPermission('user.view_all'), usersController.getUsers);
router.get('/me',checkAuth, usersController.getUserByUid);
router.get('/me/batches', checkAuth, usersController.getJoinedBatches);
router.put('/:uid/status', checkAuth , checkPermission('user.manage_role'), usersController.toggleUserStatus);
router.put('/:uid/role', checkAuth, checkPermission('user.manage_role'), usersController.changeUserRole);
router.delete('/:uid', checkAuth, checkPermission('user.manage_role'), usersController.deleteUser);
module.exports = router;
