'use strict';

const fs           = require('fs');
const path         = require('path');
const { v4: uuidv4 } = require('uuid');
const db           = require('../models');
const storageUtil  = require('../utils/storage');
const { logger }   = require('../utils/logger');

// Lazy-load nexaplot dan pdf-lib agar tidak crash jika modul belum ready
let NexaplotEngine = null;
let pdfLib         = null;

async function getEngine() {
  if (!NexaplotEngine) {
    const nexa = await import('nexaplot');
    NexaplotEngine = nexa.NexaplotEngine || nexa.default;
  }
  if (!pdfLib) {
    // pdf-lib bisa di-require tapi untuk konsistensi di async context gunakan import
    const plib = await import('pdf-lib');
    pdfLib = plib.PDFDocument ? plib : plib.default;
  }
  return { NexaplotEngine, pdfLib };
}

const LICENSE_KEY = process.env.NEXAPLOT_LICENSE_KEY || '';

// =============================================================================
// HELPER: Normalize section_scores dari format DB (nested/flat) → flat number
// =============================================================================

/**
 * Normalize section_scores dari berbagai format ke flat { namaSection: convertedScore }.
 * Format DB (nested): { Listening: { correct: 30, total: 50, convertedScore: 523, percentage: 60 } }
 * Format flat (lama): { Listening: 523 }
 * @param {object|string} raw  - raw section_scores dari DB
 * @returns {object} flat map: { namaSection: number }
 */
function normalizeSectionScores(raw) {
  if (!raw) return {};
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (_) { return {}; }
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const flat = {};
  for (const [name, val] of Object.entries(parsed)) {
    // Normalize key (section name) to NFC and standardize quotes for matching
    const normName = normalizeKey(name);
    
    if (val === null || val === undefined) {
      flat[normName] = 0;
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      // Handle various nested formats
      if (typeof val.convertedScore === 'number') {
        flat[normName] = val.convertedScore;
      } else if (typeof val.score === 'number') {
        flat[normName] = val.score;
      } else if (typeof val.value === 'number') {
        flat[normName] = val.value;
      } else {
        flat[normName] = 0;
      }
    } else {
      flat[normName] = typeof val === 'number' ? val : Number(val) || 0;
    }
  }
  return flat;
}

/**
 * Normalisasi string kunci (nama section) agar tahan terhadap variasi biner Unicode (NFC/NFD)
 * serta perbedaan jenis tanda kutip (Smart vs Straight quotes).
 * @param {string} str 
 * @returns {string} normalized string
 */
function normalizeKey(str) {
  if (!str) return '';
  return str.normalize('NFC')
    .toLowerCase()
    .replace(/[‘’“”]/g, "'") // Standarisasi tanda kutip
    .trim();
}

// =============================================================================
// HELPER: Resolve nilai dari data context berdasarkan dotted source path
// =============================================================================

/**
 * Resolve nilai dari nested object berdasarkan dotted key path.
 * Contoh: resolveValue("detailuser.namaLengkap", ctx) → "Budi Santoso"
 * Mengembalikan '' jika path tidak ditemukan.
 * @param {string} sourcePath
 * @param {object} ctx
 * @returns {any}
 */
function resolveValue(sourcePath, ctx) {
  if (!sourcePath || !ctx) return '';
  const keys = sourcePath.split('.');
  let val = ctx;
  for (const k of keys) {
    if (val === null || val === undefined) return '';
    val = val[k];
  }
  return val !== undefined && val !== null ? val : '';
}

// =============================================================================
// HELPER: Build userData dari mapping_data + data context
// =============================================================================

/**
 * Build userData object untuk dikirim ke nexaplot engine.
 * mapping_data: Array<{ variable: string, source: string, type: string }>
 * ctx: object data context peserta
 * @param {Array} mappingData
 * @param {object} ctx
 * @returns {object} userData
 */
function buildUserData(mappingData, ctx) {
  const userData = {};
  if (!Array.isArray(mappingData)) return userData;

  for (const mapping of mappingData) {
    const { variable, source, type } = mapping;
    if (!variable || !source) continue;

    // Special case 1: "section_scores_table" → array of { section, score } untuk tipe table
    if (source === 'section_scores_table') {
      // ctx.section_scores sudah di-normalize menjadi flat { namaSection: number }
      const sectionScores = ctx.section_scores || {};
      userData[variable] = Object.entries(sectionScores).map(([section, score]) => ({
        section,
        score: typeof score === 'number' ? score : Number(score) || 0
      }));
    }
    // Special case 2: "section_score.<NamaSection>" → nilai konversi section tertentu
    else if (source.startsWith('section_score.')) {
      const targetSection = normalizeKey(source.slice('section_score.'.length));
      const sectionScores = ctx.section_scores || {}; // Keys are already normalized by normalizeSectionScores
      
      // Lookup normalized key
      const score = sectionScores[targetSection];
      userData[variable] = score !== undefined ? score : 0;
    } else {
      userData[variable] = resolveValue(source, ctx);
    }
  }

  return userData;
}

// =============================================================================
// MAIN: Generate sertifikat untuk 1 peserta
// =============================================================================

/**
 * Generate sertifikat untuk satu userresult.
 * @param {object} params
 * @param {number} params.userResultId - ID dari tabel userresults
 * @param {number|null} params.templateFormatId - Opsional, jika null gunakan template aktif
 * @returns {Promise<{ certificate: object, pdfUrl: string }>}
 */
async function generateCertificate({ userResultId, templateFormatId = null }) {
  // ── 1. Ambil data hasil ujian + user ──────────────────────────────────────
  const userResult = await db.userresult.findByPk(userResultId, {
    include: [
      {
        model: db.user,
        as: 'user',
        include: [{ model: db.detailuser }]
      },
      {
        model: db.batch,
        as: 'batch'
      }
    ]
  });

  if (!userResult) {
    throw new Error(`UserResult dengan ID ${userResultId} tidak ditemukan.`);
  }

  // ── 2. Ambil template format (aktif atau spesifik) ─────────────────────────
  let format;
  if (templateFormatId) {
    format = await db.certificate_template_format.findByPk(templateFormatId, {
      include: [{ model: db.certificate_template, as: 'template' }]
    });
    if (!format) {
      throw new Error(`Template format dengan ID ${templateFormatId} tidak ditemukan.`);
    }
  } else {
    format = await db.certificate_template_format.findOne({
      where: { is_active: true },
      include: [{ model: db.certificate_template, as: 'template' }]
    });
    if (!format) {
      throw new Error('Tidak ada template aktif. Aktifkan template terlebih dahulu.');
    }
  }

  if (!format.nexaplot_config) {
    throw new Error(
      `Template "${format.name}" belum memiliki konfigurasi desain (nexaplot_config). ` +
      'Buka editor desain dan simpan layout terlebih dahulu.'
    );
  }

  if (!format.file_pdf) {
    throw new Error(
      `Template "${format.name}" belum memiliki file PDF base template.`
    );
  }

  // ── 3. Siapkan data context peserta ──────────────────────────────────────
  const detailUser = userResult.user?.detailuser || {};

  // NORMALIZE section_scores: DB menyimpan format nested {correct, total, convertedScore, percentage}
  // atau format flat {namaSection: number}. Fungsi normalizeSectionScores() mengkonversi ke flat.
  const sectionScores = normalizeSectionScores(userResult.section_scores);

  logger.info(`[CertService] section_scores raw type: ${typeof userResult.section_scores}, normalized keys: ${Object.keys(sectionScores).join(', ')}`);

  // Generate token unik dan nomor sertifikat
  const qrToken    = uuidv4();
  const appUrl     = (process.env.APP_URL || '').replace(/\/+$/, '');
  const verifyUrl  = `${appUrl}/verify/${qrToken}`;
  const certNumber = `CERT-${userResult.batchId || 'BATCH'}-${userResultId}-${Date.now()}`;

  const ctx = {
    detailuser: {
      namaLengkap : detailUser.namaLengkap || '',
      nim         : detailUser.nim         || '',
      fakultas    : detailUser.fakultas    || '',
      prodi       : detailUser.prodi       || ''
    },
    user: {
      name        : userResult.user?.name    || '',
      email       : userResult.user?.email   || '',
      picture     : userResult.user?.picture || ''
    },
    userresult: {
      score           : userResult.score          || 0,
      cefr_level      : userResult.cefr_level     || '',
      passed          : userResult.passed ? 'Lulus' : 'Tidak Lulus',
      totalQuestions  : userResult.totalQuestions  || 0,
      correctCount    : userResult.correctCount    || 0,
      submittedAt     : userResult.submittedAt
        ? new Date(userResult.submittedAt).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric'
          })
        : ''
    },
    batch: {
      name  : userResult.batch?.name   || '',
      type  : userResult.batch?.type   || '',
      date  : userResult.batch?.start_date
        ? new Date(userResult.batch.start_date).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric'
          })
        : ''
    },
    // section_scores: flat { namaSection: convertedScore (number) }
    // Digunakan oleh buildUserData() untuk:
    //   - source: 'section_scores_table'          → Array tabel semua section
    //   - source: 'section_score.Listening'        → Nilai section Listening saja
    section_scores       : sectionScores,
    // section_scores_table: pre-computed array untuk kemudahan
    section_scores_table : Object.entries(sectionScores).map(([section, score]) => ({
      section,
      score: typeof score === 'number' ? score : Number(score) || 0
    })),
    certificate: {
      number    : certNumber,
      verifyUrl : verifyUrl,
      date      : new Date().toLocaleDateString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric'
      })
    }
  };

  // ── 4. Build userData dari mapping_data ───────────────────────────────────
  const mappingData = (() => {
    try {
      const raw = format.mapping_data;
      return Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
    } catch (_) {
      return [];
    }
  })();

  const userData = buildUserData(mappingData, ctx);

  // Pastikan variabel QR selalu menggunakan verifyUrl yang baru di-generate
  for (const mapping of mappingData) {
    if (mapping.type === 'qr' || mapping.source === 'certificate.verifyUrl') {
      userData[mapping.variable] = verifyUrl;
      logger.info(`[CertService] Variable "${mapping.variable}" set to verifyUrl: ${verifyUrl}`);
    }
  }

  logger.info(`[CertService] Generating certificate for userResultId=${userResultId}, template="${format.name}"`);
  logger.info(`[CertService] userData keys: ${Object.keys(userData).join(', ')}`);

  // ── 5. Baca PDF template dari storage ────────────────────────────────────
  const templatePath = storageUtil.resolvePath(format.file_pdf);
  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `File PDF template tidak ditemukan di path: ${templatePath}. ` +
      'Pastikan file sudah di-upload dengan benar.'
    );
  }
  const templateBuffer = fs.readFileSync(templatePath);

  const { debugLog } = useDebug();
  await debugLog('User Data', { userData });
  await debugLog('Template Config', { templateConfig: format.nexaplot_config });
  await debugLog('Mapping Data', { mappingData });
  await debugLog('Template Path', { templatePath });
  await debugLog('Certificate Number', { certNumber });
  await debugLog('Verify URL', { verifyUrl });
  await debugLog('User Result', { userResult });
  await debugLog('Section Scores', { sectionScores });


  // ── 6. Generate PDF via nexaplot engine ──────────────────────────────────
  const { NexaplotEngine: Engine, pdfLib: pLib } = await getEngine();
  const engine   = new Engine(pLib, LICENSE_KEY);
  const pdfBytes = await engine.generate(templateBuffer, format.nexaplot_config, userData);

  // ── 7. Simpan file PDF ke storage ─────────────────────────────────────────
  const fileName  = `cert-${qrToken}.pdf`;
  const certDir   = storageUtil.ensureDir('storage/certificates');
  const savePath  = path.join(certDir, fileName);
  fs.writeFileSync(savePath, Buffer.from(pdfBytes));
  const publicUrl = storageUtil.getPublicUrl(`storage/certificates/${fileName}`);

  logger.info(`[CertService] PDF saved to: ${savePath}`);

  // ── 8. Upsert record ke tabel certificates ────────────────────────────────
  const [certificate] = await db.certificate.upsert({
    certificateNumber : certNumber,
    userId            : userResult.userId,
    name              : detailUser.namaLengkap || userResult.user?.name || '',
    event             : userResult.batch?.name || '',
    date              : new Date(),
    score             : userResult.score || 0,
    qrToken           : qrToken,
    verifyUrl         : verifyUrl,
    pdfUrl            : publicUrl,
    batchId           : userResult.batchId,
    userResultId      : userResultId,
    templateFormatId  : format.id,
    generated_data    : { userData, mappingData }
  });

  logger.info(`[CertService] Certificate record upserted: ${certNumber}`);

  return { certificate, pdfUrl: publicUrl };
}

// =============================================================================
// BATCH: Generate sertifikat untuk semua peserta dalam 1 batch
// =============================================================================

/**
 * Generate sertifikat untuk semua peserta yang sudah COMPLETED dalam satu batch.
 * @param {object} params
 * @param {string} params.batchId
 * @param {number|null} params.templateFormatId
 * @returns {Promise<Array<{ userResultId, success, pdfUrl?, error? }>>}
 */
async function generateBatchCertificates({ batchId, templateFormatId = null }) {
  const results = await db.userresult.findAll({
    where: { batchId, status: 'COMPLETED' }
  });

  if (results.length === 0) {
    throw new Error(
      `Tidak ada peserta dengan status COMPLETED untuk batch ${batchId}.`
    );
  }

  logger.info(`[CertService] Starting batch generate for batchId=${batchId}, total=${results.length} peserta`);

  const outcomes = [];
  for (const r of results) {
    try {
      const out = await generateCertificate({
        userResultId    : r.id,
        templateFormatId
      });
      outcomes.push({
        userResultId : r.id,
        userId       : r.userId,
        success      : true,
        pdfUrl       : out.pdfUrl
      });
    } catch (err) {
      logger.error(`[CertService] Error generating for userResultId=${r.id}: ${err.message}`);
      outcomes.push({
        userResultId : r.id,
        userId       : r.userId,
        success      : false,
        error        : err.message
      });
    }
  }

  const successCount = outcomes.filter(o => o.success).length;
  const failCount    = outcomes.filter(o => !o.success).length;
  logger.info(`[CertService] Batch done. Success: ${successCount}, Failed: ${failCount}`);

  return outcomes;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  generateCertificate,
  generateBatchCertificates,
  // Export helpers untuk unit testing
  resolveValue,
  buildUserData,
  normalizeSectionScores
};
