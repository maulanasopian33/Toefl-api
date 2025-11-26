var express = require('express');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
