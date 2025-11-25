// routes/examRoutes.js

const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');

// --- Endpoint Baru ---

// 1. Endpoint untuk Metadata Tes (Batch)
router.get('/:testId/metadata', checkAuth, examController.getTestMetadata);

// 2. Endpoint untuk Data per Bagian (Section)
router.get('/:testId/sections/:sectionId', checkAuth, examController.getSectionData);

// 3. Endpoint untuk Menyimpan Hasil Tes
router.post('/:testId/submit', checkAuth, examController.submitTest);


// --- Endpoint Lama (Tetap dipertahankan untuk editor) ---

// Mengambil seluruh data ujian untuk editor (termasuk jawaban)
router.get('/:examId', checkAuth, checkRole(['admin']), examController.getExamData);

// Menyimpan (memperbarui) seluruh data ujian dari editor
router.put('/:examId', checkAuth, checkRole(['admin']), examController.updateExamData);

module.exports = router;