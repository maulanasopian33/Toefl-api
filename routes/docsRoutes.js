const express = require('express');
const router = express.Router();
const controller = require('../controllers/docsController');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

// ─────────────────────────────────────────────
// Public (butuh auth): Untuk tampilan reader docs
// ─────────────────────────────────────────────
router.get('/', checkAuth, controller.getPublishedDocs);
router.get('/slug/:slug', checkAuth, controller.getDocBySlug);

// ─────────────────────────────────────────────
// Admin/Developer only: Manajemen artikel docs
// ─────────────────────────────────────────────
router.get('/all', checkAuth, checkRole(['admin']), controller.getAllDocs);
router.post('/', checkAuth, checkRole(['admin']), controller.createDoc);
router.put('/:id', checkAuth, checkRole(['admin']), controller.updateDoc);
router.delete('/:id', checkAuth, checkRole(['admin']), controller.deleteDoc);

module.exports = router;
