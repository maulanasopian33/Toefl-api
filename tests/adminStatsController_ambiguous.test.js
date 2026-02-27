
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

describe('Admin Stats Controller - getFinancialRecap - Ambiguous ID Fix', () => {
    let req, res, next;

    beforeEach(() => {
        next = jest.fn();
        jest.clearAllMocks();
    });

    it('should call payment.findAll with payment.id for methodBreakdown', async () => {
        payment.findAll.mockResolvedValue([]);

        req = createMockReq();
        res = createMockRes();

        await adminStatsController.getFinancialRecap(req, res, next);

        // methodBreakdown is the 4th call to payment.findAll
        
        // calls: [0] summary, [1] trend, [2] batchBreakdown, [3] methodBreakdown
        const methodBreakdownCall = payment.findAll.mock.calls[3];

        expect(methodBreakdownCall).toBeDefined();

        // Check if the COUNT attribute uses the correct column name 'payment.id'
        // We check sequelize.col calls
        const colCalls = sequelize.col.mock.calls;
        const hasPaymentIdCall = colCalls.some(call => call[0] === 'payment.id');

        expect(hasPaymentIdCall).toBe(true);
    });
});
