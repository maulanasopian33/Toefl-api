const batchController = require('../controllers/batchController');
const { batch, section, group, question } = require('../models');

jest.mock('../models', () => {
  return {
    batch: {
      findByPk: jest.fn(),
    },
    batchsession: { name: 'batchsession' },
    user: { name: 'user' },
    sequelize: {
      transaction: jest.fn(),
    },
    batchparticipant: { name: 'batchparticipant' },
    payment: { name: 'payment' },
    section: { name: 'section' },
    group: { name: 'group' },
    question: { name: 'question' }
  };
});

describe('batchController.getBatchById', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { idBatch: 'batch-123' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  test('should return batch details with section, group, and question counts', async () => {
    const mockBatchData = {
      idBatch: 'batch-123',
      name: 'Test Batch',
      sections: [
        {
          idSection: 'sec-1',
          namaSection: 'Section 1',
          groups: [
            { idGroup: 'grp-1', questions: [{ idQuestion: 'q-1' }, { idQuestion: 'q-2' }] },
            { idGroup: 'grp-2', questions: [{ idQuestion: 'q-3' }] }
          ],
          questions: [{ idQuestion: 'q-direct-1' }]
        },
        {
          idSection: 'sec-2',
          namaSection: 'Section 2',
          groups: [
            { idGroup: 'grp-3', questions: [{ idQuestion: 'q-4' }, { idQuestion: 'q-5' }] }
          ],
          questions: []
        }
      ],
      participants: [],
      toJSON: function() { 
        const { toJSON, ...rest } = this;
        return rest;
      }
    };

    batch.findByPk.mockResolvedValue(mockBatchData);

    await batchController.getBatchById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    
    expect(response.status).toBe(true);
    expect(response.data.idBatch).toBe('batch-123');
    
    // Check global totals
    expect(response.data.totalGroups).toBe(3); // 2 + 1
    expect(response.data.totalQuestions).toBe(6); // (2+1+1) + (2+0)
    
    // Check per-section totals
    expect(response.data.sections[0].totalGroups).toBe(2);
    expect(response.data.sections[0].totalQuestions).toBe(4);
    expect(response.data.sections[1].totalGroups).toBe(1);
    expect(response.data.sections[1].totalQuestions).toBe(2);
  });

  test('should return 404 if batch not found', async () => {
    batch.findByPk.mockResolvedValue(null);

    await batchController.getBatchById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      status: false,
      message: 'Batch not found'
    });
  });
});
