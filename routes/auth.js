// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../models');
const checkAuth = require('../middlewares/authMiddleware');
const userController = require('../controllers/usersController');
router.post('/login', checkAuth, userController.handleLogin);

module.exports = router;