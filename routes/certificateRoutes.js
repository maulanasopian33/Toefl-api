'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/certificateController');
const checkAuth  = require('../middlewares/authMiddleware');
const checkRole  = require('../middlewares/checkRole');

// =============================================================================
// PUBLIC ROUTES — Tidak perlu autentikasi
// =============================================================================

/**
 * Verifikasi sertifikat via QR token (dipanggil saat scan QR).
 * GET /certificates/verify/:qrToken
 */
router.get('/verify/:qrToken', controller.verifyCertificate);

// =============================================================================
// AUTHENTICATED ROUTES — Memerlukan login
// =============================================================================

router.use(checkAuth);

/**
 * User melihat sertifikat miliknya berdasarkan userResultId.
 * GET /certificates/my/:userResultId
 */
router.get('/my/:userResultId', controller.getCertificateByUserResult);

/**
 * Download ZIP (Bulk)
 */
router.get('/download-all/zip', checkRole(['admin']), controller.downloadAllZip);

/**
 * Download file PDF sertifikat (pemilik atau admin).
 * GET /certificates/download/:id
 */
router.get('/download/:id', controller.downloadCertificate);

// =============================================================================
// ADMIN ROUTES — Memerlukan login + role admin
// =============================================================================

const adminOnly = checkRole(['admin']);

/**
 * List semua sertifikat dengan filter dan pagination.
 * GET /certificates
 * Query: page, limit, search, userId, batchId, startDate, endDate
 */
router.get('/', adminOnly, controller.getCertificates);

/**
 * Generate sertifikat untuk satu peserta (manual).
 * POST /certificates/generate/participant
 * Body: { userResultId: number, templateFormatId?: number }
 */
router.post('/generate/participant', adminOnly, controller.generateForParticipant);

/**
 * Generate sertifikat untuk seluruh peserta COMPLETED dalam satu batch (manual).
 * POST /certificates/generate/batch
 * Body: { batchId: string, templateFormatId?: number }
 */
router.post('/generate/batch', adminOnly, controller.generateForBatch);

/**
 * Hapus sertifikat beserta file PDF-nya.
 * DELETE /certificates/:id
 */
router.delete('/:id', adminOnly, controller.deleteCertificate);

module.exports = router;
