
const adminStatsController = require('../controllers/adminStatsController');
const { payment, batchparticipant, batch, sequelize } = require('../models');

// Mock req and res
const createMockReq = (query = {}) => ({ query });
const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

// We will test the getFinancialRecap function by mocking the models
jest.mock('../models', () => {
    const Sequelize = require('sequelize');
    return {
        payment: {
            findAll: jest.fn()
        },
        batchparticipant: {},
        batch: {},
        sequelize: {
            fn: jest.fn(),
            col: jest.fn(),
            literal: jest.fn(),
            models: {}
        },
        Sequelize: Sequelize
    };
});

describe('Admin Stats Controller - getFinancialRecap', () => {
    let req, res, next;

    beforeEach(() => {
        next = jest.fn();
        jest.clearAllMocks();
    });

    it('should call payment.findAll with correct attributes for batchBreakdown', async () => {
        payment.findAll.mockResolvedValue([]);
        
        req = createMockReq();
        res = createMockRes();

        await adminStatsController.getFinancialRecap(req, res, next);

        // Verify the 3rd call to payment.findAll which corresponds to batchBreakdown
        // calls: [0] summary, [1] trend, [2] batchBreakdown, [3] methodBreakdown
        const batchBreakdownCall = payment.findAll.mock.calls[2];
        
        expect(batchBreakdownCall).toBeDefined();
        const attributes = batchBreakdownCall[0].attributes;
        
        // Check if the first attribute is using the correct column name 'name'
        // attributes[0] should be [sequelize.col('participant.batch.name'), 'batchName']
        // Since we mocked sequelize.col, we can check arguments
        // But sequelize.col is called BEFORE findAll, so checking calls to sequelize.col is better
        
        const colCalls = sequelize.col.mock.calls;
        const hasCorrectColCall = colCalls.some(call => call[0] === 'participant.batch.name');
        
        expect(hasCorrectColCall).toBe(true);
    });
});
