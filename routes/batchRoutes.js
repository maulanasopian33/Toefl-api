// routes/batch.js

const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

// CREATE: Hanya admin yang bisa membuat batch baru
router.post('/', checkAuth, checkRole(['admin']), batchController.createBatch);

// READ: Semua pengguna yang sudah login bisa melihat semua batch
router.get('/', checkAuth, batchController.getAllBatches);

// READ: Semua pengguna yang sudah login bisa melihat detail batch tertentu
router.get('/:idBatch', checkAuth, batchController.getBatchById); // Perbarui parameter

// UPDATE: Hanya admin yang bisa mengubah data batch
router.put('/:idBatch', checkAuth, checkRole(['admin']), batchController.updateBatch); // Perbarui parameter

// DELETE: Hanya admin yang bisa menghapus batch
router.delete('/:idBatch', checkAuth, checkRole(['admin']), batchController.deleteBatch); // Perbarui parameter

module.exports = router;