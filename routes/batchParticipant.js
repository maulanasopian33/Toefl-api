const express = require('express');
const router = express.Router();
const controller = require('../controllers/batchParticipantController');

const checkAuth = require('../middlewares/authMiddleware');

router.post('/join', checkAuth, controller.joinBatch);
router.get('/', controller.getParticipants);
router.delete('/:id', checkAuth, controller.removeParticipant);

module.exports = router;
