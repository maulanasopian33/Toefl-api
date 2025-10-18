const express = require('express');
const router = express.Router();
const controller = require('../controllers/batchParticipantController');

router.post('/join', controller.joinBatch);
router.get('/', controller.getParticipants);

module.exports = router;
