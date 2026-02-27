
const reportController = require('../controllers/reportController');
const { userresult, batch, sequelize } = require('../models');

// Simple mock for req and res
const createMockReq = (query = {}) => ({ query });
const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

jest.mock('../models', () => {
  const Sequelize = require('sequelize');
  return {
    userresult: {
      findAndCountAll: jest.fn(),
    },
    batch: {},
    sequelize: {
      models: {
        user: {}
      }
    },
    Sequelize: Sequelize
  };
});

describe('Report Controller - getParticipantReport', () => {
  let req, res, next;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return participant report with default pagination', async () => {
    const mockData = {
      count: 1,
      rows: [
        {
          id: 1,
          score: 500,
          user: { name: 'Test User', email: 'test@example.com' },
          batch: { name: 'Batch 1' }
        }
      ]
    };

    userresult.findAndCountAll.mockResolvedValue(mockData);

    req = createMockReq();
    res = createMockRes();

    await reportController.getParticipantReport(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: true,
      data: {
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        participants: mockData.rows
      }
    });

    expect(userresult.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      limit: 10,
      offset: 0,
      order: [['createdAt', 'DESC']]
    }));
  });

  it('should filter by batchId', async () => {
    userresult.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    req = createMockReq({ batchId: '123' });
    res = createMockRes();

    await reportController.getParticipantReport(req, res, next);

    expect(userresult.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ batchId: '123' })
    }));
  });

  it('should filter by search term', async () => {
    userresult.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    req = createMockReq({ search: 'John' });
    res = createMockRes();

    await reportController.getParticipantReport(req, res, next);

    // Check if the include for user contains the search clause
    const callArgs = userresult.findAndCountAll.mock.calls[0][0];
    const userInclude = callArgs.include.find(inc => inc.as === 'user');
    
    expect(userInclude).toBeDefined();
    expect(userInclude.where).toBeDefined(); 
  });

  it('should handle pagination correctly', async () => {
    userresult.findAndCountAll.mockResolvedValue({ count: 15, rows: [] });
    req = createMockReq({ page: 2, limit: 5 });
    res = createMockRes();

    await reportController.getParticipantReport(req, res, next);

    expect(userresult.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      limit: 5,
      offset: 5
    }));
    
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            totalPages: 3,
            currentPage: 2
        })
    }));
  });

  it('should handle errors', async () => {
    const error = new Error('Database Error');
    userresult.findAndCountAll.mockRejectedValue(error);
    req = createMockReq();
    res = createMockRes();

    await reportController.getParticipantReport(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
