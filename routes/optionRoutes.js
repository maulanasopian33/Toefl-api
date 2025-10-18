const express = require('express');
const router = express.Router();
const optionController = require('../controllers/optionController');

router.get('/', optionController.getAll);
router.get('/:id', optionController.getById);
router.post('/', optionController.create);
router.put('/:id', optionController.update);
router.delete('/:id', optionController.delete);

module.exports = router;
