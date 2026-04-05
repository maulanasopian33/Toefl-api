'use strict';

/**
 * Unit Test: certificateService.js
 * Menguji: resolveValue, buildUserData, generateCertificate, generateBatchCertificates
 *
 * Jalankan dengan: npm run test -- --testPathPattern=certificateService
 */

// =============================================================================
// MOCKING
// =============================================================================

// Mock modul-modul eksternal sebelum require service
jest.mock('nexaplot', () => {
  return jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue(Buffer.from('MOCK_PDF_BYTES'))
  }));
});

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn()
  }
}));

jest.mock('fs', () => ({
  readFileSync  : jest.fn().mockReturnValue(Buffer.from('MOCK_PDF_TEMPLATE')),
  writeFileSync : jest.fn(),
  existsSync    : jest.fn().mockReturnValue(true),
  createReadStream: jest.fn()
}));

jest.mock('../utils/storage', () => ({
  resolvePath : jest.fn().mockReturnValue('/mock/storage/template/test.pdf'),
  ensureDir   : jest.fn().mockReturnValue('/mock/storage/certificates'),
  getPublicUrl: jest.fn().mockImplementation((p) => `https://cdn.example.com/${p}`)
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

// Mock database models
jest.mock('../models', () => ({
  userresult: {
    findByPk : jest.fn(),
    findAll  : jest.fn()
  },
  user       : {},
  detailuser : {},
  batch      : {},
  certificate_template_format: {
    findByPk : jest.fn(),
    findOne  : jest.fn()
  },
  certificate: {
    upsert: jest.fn().mockResolvedValue([{ id: 'mock-uuid', certificateNumber: 'CERT-TEST-1' }])
  }
}));

const db             = require('../models');
const { resolveValue, buildUserData, generateCertificate, generateBatchCertificates }
  = require('../services/certificateService');

// =============================================================================
// DATA FIXTURES
// =============================================================================

const mockUserResult = {
  id          : 1,
  userId      : 'uid-001',
  batchId     : 'BATCH-2026-001',
  score       : 550,
  cefr_level  : 'B2',
  passed      : true,
  status      : 'COMPLETED',
  totalQuestions: 100,
  correctCount  : 82,
  section_scores: { listening: 523, structure: 480, reading: 510 },
  submittedAt   : new Date('2026-04-05'),
  user: {
    name     : 'Budi Santoso',
    email    : 'budi@example.com',
    picture  : null,
    detailuser: {
      namaLengkap : 'Budi Santoso',
      nim         : '12345678',
      fakultas    : 'Teknik',
      prodi       : 'Informatika'
    }
  },
  batch: {
    name       : 'Batch April 2026',
    type       : 'TOEFL',
    start_date : new Date('2026-04-01')
  }
};

const mockTemplateFormat = {
  id             : 1,
  templateId     : 1,
  name           : 'Format Default',
  file_pdf       : 'template/test.pdf',
  nexaplot_config: 'NXCFG-eyJ2ZXJzaW9uIjoiMS4wIn0=',
  is_active      : true,
  mapping_data   : [
    { variable: 'namaPeserta',  source: 'detailuser.namaLengkap', type: 'text' },
    { variable: 'nilaiTotal',   source: 'userresult.score',       type: 'text' },
    { variable: 'nimPeserta',   source: 'detailuser.nim',         type: 'text' },
    { variable: 'namaBatch',    source: 'batch.name',             type: 'text' },
    { variable: 'nilaiSection', source: 'section_scores_table',   type: 'table' },
    { variable: 'qrCode',       source: 'certificate.verifyUrl',  type: 'qr' }
  ],
  template: { name: 'Template Utama', status: true }
};

// =============================================================================
// TEST SUITE 1: resolveValue
// =============================================================================

describe('resolveValue()', () => {
  const ctx = {
    detailuser : { namaLengkap: 'Budi Santoso', nim: '12345678' },
    userresult : { score: 550, cefr_level: 'B2' },
    section_scores: { listening: 523, structure: 480 }
  };

  test('✅ Resolve flat key (userresult.score)', () => {
    expect(resolveValue('userresult.score', ctx)).toBe(550);
  });

  test('✅ Resolve nested key (detailuser.namaLengkap)', () => {
    expect(resolveValue('detailuser.namaLengkap', ctx)).toBe('Budi Santoso');
  });

  test('✅ Resolve deeply nested key (section_scores.listening)', () => {
    expect(resolveValue('section_scores.listening', ctx)).toBe(523);
  });

  test('❌ Return empty string jika key tidak ditemukan', () => {
    expect(resolveValue('detailuser.foto', ctx)).toBe('');
  });

  test('❌ Return empty string jika ctx null', () => {
    expect(resolveValue('userresult.score', null)).toBe('');
  });

  test('❌ Return empty string jika sourcePath kosong', () => {
    expect(resolveValue('', ctx)).toBe('');
  });
});

// =============================================================================
// TEST SUITE 2: buildUserData
// =============================================================================

describe('buildUserData()', () => {
  const ctx = {
    detailuser    : { namaLengkap: 'Budi Santoso', nim: '12345678' },
    userresult    : { score: 550 },
    batch         : { name: 'Batch April 2026' },
    section_scores: { listening: 523, structure: 480, reading: 510 },
    section_scores_table: [
      { section: 'listening', score: 523 },
      { section: 'structure', score: 480 },
      { section: 'reading',   score: 510 }
    ],
    certificate   : { verifyUrl: 'https://example.com/verify/token-abc' }
  };

  test('✅ Build userData dari mapping standar', () => {
    const mappingData = [
      { variable: 'namaPeserta', source: 'detailuser.namaLengkap', type: 'text' },
      { variable: 'nilaiTotal',  source: 'userresult.score',       type: 'text' },
      { variable: 'namaBatch',   source: 'batch.name',             type: 'text' }
    ];
    const result = buildUserData(mappingData, ctx);
    expect(result.namaPeserta).toBe('Budi Santoso');
    expect(result.nilaiTotal).toBe(550);
    expect(result.namaBatch).toBe('Batch April 2026');
  });

  test('✅ Build userData dengan source section_scores_table (type table)', () => {
    const mappingData = [
      { variable: 'nilaiSection', source: 'section_scores_table', type: 'table' }
    ];
    const result = buildUserData(mappingData, ctx);
    expect(Array.isArray(result.nilaiSection)).toBe(true);
    expect(result.nilaiSection).toHaveLength(3);
    expect(result.nilaiSection[0]).toEqual({ section: 'listening', score: 523 });
  });

  test('✅ Build userData dengan type qr', () => {
    const mappingData = [
      { variable: 'qrCode', source: 'certificate.verifyUrl', type: 'qr' }
    ];
    const result = buildUserData(mappingData, ctx);
    expect(result.qrCode).toBe('https://example.com/verify/token-abc');
  });

  test('❌ Return {} jika mappingData bukan array', () => {
    expect(buildUserData(null, ctx)).toEqual({});
    expect(buildUserData('invalid', ctx)).toEqual({});
  });

  test('❌ Skip mapping yang tidak punya variable atau source', () => {
    const mappingData = [
      { variable: '', source: 'userresult.score', type: 'text' },
      { variable: 'nilaiTotal', source: '', type: 'text' }
    ];
    const result = buildUserData(mappingData, ctx);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// =============================================================================
// TEST SUITE 3: generateCertificate
// =============================================================================

describe('generateCertificate()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.certificate.upsert.mockResolvedValue([
      { id: 'mock-uuid', certificateNumber: 'CERT-BATCH-2026-001-1-12345' }
    ]);
  });

  test('✅ Generate sertifikat sukses untuk userResultId yang valid', async () => {
    db.userresult.findByPk.mockResolvedValue(mockUserResult);
    db.certificate_template_format.findOne.mockResolvedValue(mockTemplateFormat);

    const result = await generateCertificate({ userResultId: 1 });

    expect(result).toHaveProperty('pdfUrl');
    expect(result.pdfUrl).toContain('storage/certificates');
    expect(db.certificate.upsert).toHaveBeenCalledTimes(1);

    // Verifikasi bahwa upsert dipanggil dengan data yang benar
    const upsertCall = db.certificate.upsert.mock.calls[0][0];
    expect(upsertCall.userId).toBe('uid-001');
    expect(upsertCall.score).toBe(550);
  });

  test('❌ Error jika userResult tidak ditemukan', async () => {
    db.userresult.findByPk.mockResolvedValue(null);

    await expect(generateCertificate({ userResultId: 999 }))
      .rejects
      .toThrow('UserResult dengan ID 999 tidak ditemukan.');
  });

  test('❌ Error jika tidak ada template aktif', async () => {
    db.userresult.findByPk.mockResolvedValue(mockUserResult);
    db.certificate_template_format.findOne.mockResolvedValue(null);

    await expect(generateCertificate({ userResultId: 1 }))
      .rejects
      .toThrow('Tidak ada template aktif.');
  });

  test('❌ Error jika template belum memiliki nexaplot_config', async () => {
    db.userresult.findByPk.mockResolvedValue(mockUserResult);
    db.certificate_template_format.findOne.mockResolvedValue({
      ...mockTemplateFormat,
      nexaplot_config: null
    });

    await expect(generateCertificate({ userResultId: 1 }))
      .rejects
      .toThrow('belum memiliki konfigurasi desain');
  });

  test('❌ Error jika template belum memiliki file_pdf', async () => {
    db.userresult.findByPk.mockResolvedValue(mockUserResult);
    db.certificate_template_format.findOne.mockResolvedValue({
      ...mockTemplateFormat,
      file_pdf: null
    });

    await expect(generateCertificate({ userResultId: 1 }))
      .rejects
      .toThrow('belum memiliki file PDF');
  });

  test('✅ Generate dengan templateFormatId spesifik', async () => {
    db.userresult.findByPk.mockResolvedValue(mockUserResult);
    db.certificate_template_format.findByPk.mockResolvedValue(mockTemplateFormat);

    const result = await generateCertificate({ userResultId: 1, templateFormatId: 1 });

    expect(db.certificate_template_format.findByPk).toHaveBeenCalledWith(
      1,
      expect.any(Object)
    );
    expect(result).toHaveProperty('pdfUrl');
  });
});

// =============================================================================
// TEST SUITE 4: generateBatchCertificates
// =============================================================================

describe('generateBatchCertificates()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('✅ Batch generate: partial success (2 sukses, 1 gagal)', async () => {
    db.certificate_template_format.findOne.mockResolvedValue(mockTemplateFormat);
    db.userresult.findAll.mockResolvedValue([
      { ...mockUserResult, id: 1 },
      { ...mockUserResult, id: 2 },
      { ...mockUserResult, id: 3 }
    ]);

    // userResultId=3 akan gagal (simulasikan)
    db.userresult.findByPk
      .mockResolvedValueOnce({ ...mockUserResult, id: 1 })  // sukses
      .mockResolvedValueOnce({ ...mockUserResult, id: 2 })  // sukses
      .mockResolvedValueOnce(null);                          // gagal (not found)

    db.certificate.upsert.mockResolvedValue([{ id: 'uuid-1' }]);

    const results = await generateBatchCertificates({ batchId: 'BATCH-2026-001' });

    expect(results).toHaveLength(3);
    expect(results.filter(r => r.success)).toHaveLength(2);
    expect(results.filter(r => !r.success)).toHaveLength(1);
    expect(results[2].error).toContain('tidak ditemukan');
  });

  test('❌ Throw error jika tidak ada peserta COMPLETED dalam batch', async () => {
    db.userresult.findAll.mockResolvedValue([]);

    await expect(generateBatchCertificates({ batchId: 'BATCH-EMPTY' }))
      .rejects
      .toThrow('Tidak ada peserta dengan status COMPLETED');
  });
});
