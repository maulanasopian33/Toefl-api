const express = require('express');
const router = express.Router();
const controller = require('../controllers/certificateTemplateController');
const checkAuth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/checkRole');
const multer = require('multer');
const storageUtil = require('../utils/storage');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Configure multer for docx templates
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
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Hanya file .docx yang diizinkan'), false);
    }
  }
});

// All routes require authentication and admin/system.app permission (or similar)
router.use(checkAuth);
router.use(checkRole(['admin'], 'system.app')); // Adjust permission as needed

router.get('/', controller.getAllTemplates);
router.get('/:id', controller.getTemplateById);
router.post('/save', upload.single('file_docx'), controller.saveTemplate);
router.delete('/:id', controller.deleteTemplate);

module.exports = router;
