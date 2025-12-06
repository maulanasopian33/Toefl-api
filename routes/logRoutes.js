const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

router.get('/', checkAuth, checkRole(['admin']), logController.getLogsByDate);

module.exports = router;