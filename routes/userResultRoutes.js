const express = require('express');
const router = express.Router();
const userResultController = require('../controllers/userResultController');

router.get('/', userResultController.getAll);
router.get('/user/:userId', userResultController.getByUser);
router.get('/batch/:batchId', userResultController.getByBatch);
module.exports = router;
