'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/certificateTemplateController');
const checkAuth  = require('../middlewares/authMiddleware');
const checkRole  = require('../middlewares/checkRole');
const multer     = require('multer');
const storageUtil = require('../utils/storage');
const { v4: uuidv4 } = require('uuid');
const path       = require('path');

// =============================================================================
// Multer — PDF Upload Configuration
// =============================================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = storageUtil.ensureDir('template');
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `template-${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Hanya file PDF (.pdf) yang diizinkan sebagai base template.'), false);
    }
  }
});

// =============================================================================
// PUBLIC — Template Aktif (untuk NexaplotEditor di FE)
// =============================================================================

/**
 * Mengambil template + konfigurasi nexaplot yang sedang aktif.
 * GET /certificate-templates/active
 */
router.get('/active', checkAuth, controller.getActiveTemplate);

// =============================================================================
// ADMIN ROUTES — semua memerlukan autentikasi + role admin
// =============================================================================

router.use(checkAuth);
router.use(checkRole(['admin']));

/**
 * List semua template beserta format-nya.
 * GET /certificate-templates
 */
router.get('/', controller.getAllTemplates);

/**
 * Detail satu template berdasarkan ID.
 * GET /certificate-templates/:id
 */
router.get('/:id', controller.getTemplateById);

/**
 * Create / Update template.
 * POST /certificate-templates/save
 * Multipart body:
 *   - file_pdf (file)       → base PDF template
 *   - name (string)
 *   - status (boolean)      → true = set sebagai aktif
 *   - nexaplot_config (string) → NXCFG-... string dari designer
 *   - mapping_data (JSON string) → array mapping variabel
 */
router.post('/save', upload.single('file_pdf'), controller.saveTemplate);

/**
 * Khusus simpan nexaplot_config saja (tanpa upload file, dari NexaplotEditor @save event).
 * POST /certificate-templates/:id/config
 * Body JSON: { nexaplot_config: "NXCFG-..." }
 */
router.post('/:id/config', express.json(), async (req, res, next) => {
  // Re-route ke saveTemplate dengan id di body
  req.body.id = req.params.id;
  controller.saveTemplate(req, res, next);
});

/**
 * Hapus template beserta format-nya.
 * DELETE /certificate-templates/:id
 */
router.delete('/:id', controller.deleteTemplate);

module.exports = router;
