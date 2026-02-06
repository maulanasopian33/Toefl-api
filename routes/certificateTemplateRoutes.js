const express = require('express');
const router = express.Router();
const controller = require('../controllers/certificateTemplateController');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

// All routes require authentication and admin/system.app permission (or similar)
router.use(checkAuth);
router.use(checkRole(['admin'], 'system.app')); // Adjust permission as needed

router.get('/', controller.getAllTemplates);
router.get('/:id', controller.getTemplateById);
router.post('/save', controller.saveTemplate);
router.delete('/:id', controller.deleteTemplate);

module.exports = router;
