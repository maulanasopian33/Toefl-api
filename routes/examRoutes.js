// routes/examRoutes.js

const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

// --- Endpoint untuk Peserta Ujian ---

// 1. Endpoint untuk mendapatkan metadata ujian (info dasar)
router.get('/:testId/metadata', checkAuth, examController.getTestMetadata);

// 2. Endpoint untuk mendapatkan data soal per bagian (section)
router.get('/:testId/sections/:sectionId', checkAuth, examController.getSectionData);

// 3. Endpoint untuk mengirim jawaban dan mendapatkan hasil
router.post('/:testId/submit', checkAuth, examController.submitTest);


// --- Endpoint untuk Editor/Admin ---

// Mengambil seluruh data ujian untuk editor (termasuk jawaban)
router.get('/:examId', checkAuth, checkRole(['admin']), examController.getExamData);

// Menyimpan (memperbarui) seluruh data ujian dari editor
router.put('/:examId', checkAuth, checkRole(['admin']), examController.updateExamData);

module.exports = router;