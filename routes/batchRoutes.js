// routes/batch.js

const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// CREATE: Hanya admin yang bisa membuat batch baru
router.post('/', checkAuth, checkPermission('batch.create'), batchController.createBatch);

// READ: Semua pengguna yang sudah login bisa melihat semua batch
router.get('/', checkAuth, batchController.getAllBatches);

// READ: Semua pengguna yang sudah login bisa melihat detail batch tertentu
router.get('/:idBatch', checkAuth, batchController.getBatchById); // Perbarui parameter

// UPDATE: Hanya admin yang bisa mengubah data batch
router.put('/:idBatch', checkAuth, checkPermission('batch.update'), batchController.updateBatch); // Perbarui parameter

// DELETE: Hanya admin yang bisa menghapus batch
router.delete('/:idBatch', checkAuth, checkPermission('batch.delete'), batchController.deleteBatch); // Perbarui parameter

module.exports = router;