// routes/examRoutes.js

const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const checkAuth = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/rbacMiddleware');

// --- Endpoint untuk Peserta Ujian ---

// 1. Endpoint untuk mendapatkan metadata ujian (info dasar)
router.get('/:testId/metadata', checkAuth, examController.getTestMetadata);

// 2. Endpoint untuk mendapatkan data soal per bagian (section)
router.get('/:testId/sections/:sectionId', checkAuth, examController.getSectionData);

// 3. Endpoint untuk mengirim jawaban dan mendapatkan hasil
router.post('/:testId/submit', checkAuth, checkPermission('test.submit'), examController.submitTest);

// 4. Endpoint untuk mendapatkan daftar riwayat tes pengguna
router.get('/history', checkAuth, checkPermission('batch.read'), examController.getTestHistoryList);

// 5. Endpoint untuk mendapatkan detail hasil tes dari riwayat
router.get('/history/:historyId', checkAuth, checkPermission('batch.read'), examController.getTestResult);


// --- Endpoint untuk Editor/Admin ---

// Mengambil seluruh data ujian untuk editor (termasuk jawaban)
router.get('/:examId', checkAuth, checkPermission('batch.update'), examController.getExamData);

// Menyimpan (memperbarui) seluruh data ujian dari editor
router.put('/:examId', checkAuth, checkPermission('batch.update'), examController.updateExamData);

module.exports = router;