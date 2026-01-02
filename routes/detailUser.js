// routes/detailUser.js

const express = require('express');
const router = express.Router();
const detailUserController = require('../controllers/detailUserController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// CREATE atau UPDATE (Upsert): Menyimpan data detail user
router.post('/', checkAuth, detailUserController.upsertDetailUser);

// READ: Mendapatkan data detail user
router.get('/', checkAuth, detailUserController.getDetailUser);

// UPDATE: Mengubah data detail user
router.put('/', checkAuth, detailUserController.updateDetailUser);

// DELETE: Menghapus data detail user (Opsional)
router.delete('/', checkAuth, detailUserController.deleteDetailUser);

// Contoh endpoint yang hanya bisa diakses admin untuk melihat semua detail user
router.get('/all', checkAuth, checkPermission('user.view_all'), async (req, res, next) => {
  try {
    const allDetails = await DetailUser.findAll();
    res.json(allDetails);
  } catch (error) {
    next(error);
  }
});

module.exports = router;