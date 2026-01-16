const resultController = require('../controllers/resultController');
const { userresult, user, detailuser, batch, sequelize } = require('../models');

// Mock models
jest.mock('../models', () => {
  const Sequelize = require('sequelize');
  return {
    userresult: {
      findAndCountAll: jest.fn(),
      findOne: jest.fn(),
    },
    user: {},
    detailuser: {},
    batch: {},
    certificate: {}, // Mock if needed
    sequelize: {
        fn: jest.fn(),
        col: jest.fn(),
        literal: jest.fn()
    },
    Op: Sequelize.Op
  };
});

describe('resultController.getCandidates', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('should return paginated candidates with default params', async () => {
    // Mock Data
    const mockRows = [
      {
        id: 1,
        score: 500,
        submittedAt: new Date('2023-01-01'),
        user: {
          uid: 'u1',
          name: 'User 1',
          email: 'u1@test.com',
          detailuser: { nim: '12345', namaLengkap: 'User One', prodi: 'TI' }
        },
        batch: { id: 1, name: 'Batch 1', scoring_type: 'TOEFL' }
      }
    ];
    userresult.findAndCountAll.mockResolvedValue({ count: 1, rows: mockRows });
    userresult.findOne.mockResolvedValue({ get: () => 500 }); // Mock avg score

    await resultController.getCandidates(req, res, next);

    expect(userresult.findAndCountAll).toHaveBeenCalled();
    const callArgs = userresult.findAndCountAll.mock.calls[0][0];
    
    // Default pagination
    expect(callArgs.limit).toBe(10);
    expect(callArgs.offset).toBe(0);
    // Default sort
    expect(callArgs.order).toEqual([['submittedAt', 'DESC']]);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.any(Array),
      meta: expect.objectContaining({
        total: 1,
        page: 1,
        summary: expect.any(Object)
      })
    }));
    
    // Check Data mapping
    const responseData = res.json.mock.calls[0][0].data[0];
    expect(responseData.id).toBe('res-1');
    expect(responseData.score).toBe(500);
    expect(responseData.nim).toBe('12345');
  });

  test('should filter by batch_id', async () => {
    req.query.batch_id = '101';
    userresult.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    userresult.findOne.mockResolvedValue(null);

    await resultController.getCandidates(req, res, next);

    const callArgs = userresult.findAndCountAll.mock.calls[0][0];
    expect(callArgs.where.batchId).toBe('101');
  });

  test('should search by name or nim', async () => {
    req.query.search = 'Budi';
    userresult.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    userresult.findOne.mockResolvedValue(null);

    await resultController.getCandidates(req, res, next);

    const callArgs = userresult.findAndCountAll.mock.calls[0][0];
    // Check included user where clause
    const userInclude = callArgs.include.find(i => i.as === 'user');
    expect(userInclude).toBeDefined();
    // Complex Op check might be tricky directly, but we can check structure
    expect(userInclude.where).toBeDefined();
  });

  test('should sort by score ASC', async () => {
    req.query.sort_by = 'score';
    req.query.order = 'asc';
    userresult.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    userresult.findOne.mockResolvedValue(null);

    await resultController.getCandidates(req, res, next);

    const callArgs = userresult.findAndCountAll.mock.calls[0][0];
    expect(callArgs.order).toEqual([['score', 'ASC']]);
  });
  
  test('should sort by name', async () => {
    req.query.sort_by = 'name';
    userresult.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    userresult.findOne.mockResolvedValue(null);
    
    await resultController.getCandidates(req, res, next);
    
    // Cannot easily check model reference equality in mock, but structure:
    const callArgs = userresult.findAndCountAll.mock.calls[0][0];
    expect(callArgs.order[0][1]).toBe('name');
    expect(callArgs.order[0][2]).toBe('DESC'); // Default order
  });

});
