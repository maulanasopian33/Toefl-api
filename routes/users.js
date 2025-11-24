const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');


const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');
/* GET users listing. */
router.get('/',checkAuth, usersController.getUsers);
router.get('/me',checkAuth, usersController.getUserByUid);
router.get('/me/batches', checkAuth, usersController.getJoinedBatches);
router.put('/:uid/status', checkAuth , checkRole(['admin']), usersController.toggleUserStatus);
router.put('/:uid/role', checkAuth, checkRole(['admin']), usersController.changeUserRole);
router.delete('/:uid', checkAuth, checkRole(['admin']), usersController.deleteUser);
module.exports = router;
