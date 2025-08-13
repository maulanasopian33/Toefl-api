const express = require('express');
const checkAuth = require('../middlewares/authMiddleware');
const router = express.Router();
const usersController = require('../controllers/usersController');

/* GET users listing. */
router.get('/',checkAuth, usersController.getUsers);
router.get('/me',checkAuth, usersController.getUserByUid);

module.exports = router;
