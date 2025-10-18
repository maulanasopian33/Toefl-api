const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');

// POST /results/calculate
router.post('/calculate', resultController.calculateResult);

module.exports = router;
