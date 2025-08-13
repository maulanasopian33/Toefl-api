var express = require('express');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');
var router = express.Router();

/* GET home page. */
router.get('/', checkAuth, checkRole(['admin']), function(req, res, next) {
  res.send('berhasil')
});

module.exports = router;
