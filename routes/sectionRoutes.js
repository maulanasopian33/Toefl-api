const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');

router.get('/', sectionController.getAll);
router.get('/:id', sectionController.getById);
router.post('/', sectionController.create);
router.put('/:id', sectionController.update);
router.delete('/:id', sectionController.remove);

module.exports = router;
