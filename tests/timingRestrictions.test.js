const batchParticipantController = require('../controllers/batchParticipantController');
const examController = require('../controllers/examController');
const db = require('../models');

jest.mock('../models', () => {
  return {
    batch: {
      findByPk: jest.fn(),
    },
    batchparticipant: {
      count: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    },
    payment: {
      findOne: jest.fn(),
      create: jest.fn(),
    },
    section: {
      findByPk: jest.fn(),
    },
    question: {
      findAll: jest.fn(),
    },
    user: {
      findOne: jest.fn(),
    },
    useranswer: {
      destroy: jest.fn(),
      bulkCreate: jest.fn(),
    },
    userresult: {
        count: jest.fn()
    },
    sequelize: {
      transaction: jest.fn(() => ({
        commit: jest.fn(),
        rollback: jest.fn(),
      })),
    },
  };
});

jest.mock('../utils/invoiceGenerator', () => ({
  generateInvoiceNumber: jest.fn(() => 'INV-TEST-123'),
}));

describe('Timing Restrictions Tests', () => {
  let req, res, next;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('batchParticipantController.joinBatch', () => {
    test('should fail if registration is not yet open', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      db.batch.findByPk.mockResolvedValue({
        idBatch: 'batch-1',
        status: 'OPEN',
        registration_open_at: futureDate,
      });

      req = {
        user: { uid: 'user-1' },
        body: { batchId: 'batch-1' },
      };

      await batchParticipantController.joinBatch(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Pendaftaran belum dibuka.'
      }));
    });

    test('should fail if registration is already closed', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      db.batch.findByPk.mockResolvedValue({
        idBatch: 'batch-1',
        status: 'OPEN',
        registration_close_at: pastDate,
      });

      req = {
        user: { uid: 'user-1' },
        body: { batchId: 'batch-1' },
      };

      await batchParticipantController.joinBatch(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Masa pendaftaran telah berakhir.'
      }));
    });

    test('should fail if batch status is not OPEN or RUNNING', async () => {
      db.batch.findByPk.mockResolvedValue({
        idBatch: 'batch-1',
        status: 'CLOSED',
      });

      req = {
        user: { uid: 'user-1' },
        body: { batchId: 'batch-1' },
      };

      await batchParticipantController.joinBatch(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Pendaftaran tidak diizinkan')
      }));
    });
  });

  describe('examController.getSectionData', () => {
    test('should fail if test has not started yet', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      db.section.findByPk.mockResolvedValue({
        idSection: 'sec-1',
        batch: {
          start_date: futureDate,
          status: 'RUNNING'
        }
      });

      req = {
        params: { sectionId: 'sec-1' }
      };

      await examController.getSectionData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Ujian belum dimulai. Silakan tunggu jadwal yang ditentukan.'
      }));
    });

    test('should fail if test has already ended', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      db.section.findByPk.mockResolvedValue({
        idSection: 'sec-1',
        batch: {
          end_date: pastDate,
          status: 'RUNNING'
        }
      });

      req = {
        params: { sectionId: 'sec-1' }
      };

      await examController.getSectionData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Waktu pengerjaan ujian telah berakhir.'
      }));
    });
  });

  describe('examController.submitTest', () => {
    test('should fail if submitting long after end_date', async () => {
      const wayPastDate = new Date();
      wayPastDate.setMinutes(wayPastDate.getMinutes() - 10); // 10 mins ago (tolerance is 5)

      db.batch.findByPk.mockResolvedValue({
        idBatch: 'batch-1',
        end_date: wayPastDate,
        status: 'RUNNING'
      });

      req = {
        params: { testId: 'batch-1' },
        body: { answers: [{ questionId: 'q-1', userAnswer: 'opt-1' }] },
        user: { uid: 'user-1' }
      };

      await examController.submitTest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Waktu penyerahan jawaban telah berakhir (melewati batas waktu).'
      }));
    });
  });
});
