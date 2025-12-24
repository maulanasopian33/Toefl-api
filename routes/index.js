var express = require('express');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');
const { logger } = require('../utils/logger');
var router = express.Router();
const certificateController = require('../controllers/certificateController');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/**
 * Route untuk menerima Callback dari Service Python
 * Payload: { original_data, result: { download_url, pdf_path }, status, timestamp }
 */
router.post('/callback', certificateController.handleCallback);

/**
 * Route TEST untuk memicu generate PDF (Hanya untuk testing)
 * POST /test-generate
 */
router.post('/test-generate', certificateController.testGenerate);

module.exports = router;
