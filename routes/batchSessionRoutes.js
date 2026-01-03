const express = require('express');
const router = express.Router();
const controller = require('../controllers/batchSessionController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// Create session (Admin/Editor only)
router.post('/', checkAuth, checkPermission('batch.update'), controller.createSession);

// Get sessions by batch (Authenticated users)
router.get('/batch/:batchId', checkAuth, controller.getSessionsByBatch);

// Get session detail
router.get('/:id', checkAuth, controller.getSessionById);

// Update session (Admin/Editor only)
router.put('/:id', checkAuth, checkPermission('batch.update'), controller.updateSession);

// Delete session (Admin/Editor only)
router.delete('/:id', checkAuth, checkPermission('batch.update'), controller.deleteSession);

module.exports = router;