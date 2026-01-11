const express = require('express');
const router = express.Router();
const ScoringController = require('../controllers/scoringController');
// const { authenticate, authorize } = require('../middlewares/auth'); // Assuming auth middlewares exist

// Admin only access (you can adjust roles as needed)
router.get('/', ScoringController.index);
router.get('/:id', ScoringController.show);
router.post('/', ScoringController.store);
router.put('/:id', ScoringController.update);
router.delete('/:id', ScoringController.destroy);

module.exports = router;
