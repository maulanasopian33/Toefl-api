// routes/cacheRoutes.js
// Admin-only routes untuk monitoring dan manajemen Redis cache.

const express = require('express');
const router = express.Router();
const cacheController = require('../controllers/cacheController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// Semua route di sini dilindungi: harus login + memiliki permission 'system.app'

/**
 * GET /admin/cache/status
 * Menampilkan status Redis: koneksi, memory usage, hit rate, eviction stats, dll.
 */
router.get(
  '/cache/status',
  checkAuth,
  checkPermission('system.app'),
  cacheController.getStatus
);

/**
 * POST /admin/cache/clear
 * Membersihkan SEMUA cache (FLUSHDB).
 */
router.post(
  '/cache/clear',
  checkAuth,
  checkPermission('system.app'),
  cacheController.clearAll
);

/**
 * POST /admin/cache/clear/:pattern
 * Membersihkan cache berdasarkan glob pattern.
 * Contoh: POST /admin/cache/clear/exam%3A*   → hapus semua cache key "exam:*"
 *          POST /admin/cache/clear/batch%3Aall → hapus key "batch:all"
 */
router.post(
  '/cache/clear/:pattern',
  checkAuth,
  checkPermission('system.app'),
  cacheController.clearByPatternHandler
);

module.exports = router;
