// routes/examRoutes.js

const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

// Mengambil seluruh data ujian untuk editor
router.get('/:examId',  examController.getExamData);

// Menyimpan (memperbarui) seluruh data ujian dari editor
router.put('/:examId', checkAuth, checkRole(['admin']), examController.updateExamData);

module.exports = router;