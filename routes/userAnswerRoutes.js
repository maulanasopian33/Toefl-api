const express = require('express');
const router = express.Router();
const userAnswerController = require('../controllers/userAnswerController');

router.get('/', userAnswerController.getAll);
router.post('/', userAnswerController.create);
router.put('/:id', userAnswerController.update);

module.exports = router;
