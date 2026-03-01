const { calculateUserResult } = require('../services/resultService');
const { batch, userresult, useranswer } = require('../models');

jest.mock('../models', () => ({
    batch: {
        findByPk: jest.fn()
    },
    userresult: {
        findByPk: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
    },
    useranswer: {
        findAll: jest.fn()
    }
}));

// Mock logger to prevent noise
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn()
    }
}));

describe('Scoring Fix Logic Verification (Mocks)', () => {
    const testBatchId = 'batch-123';
    const testUserId = 'user-456';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('calculateUserResult should handle string initialScore and add correctly', async () => {
        // 1. Mock Batch Info with string initialScore
        batch.findByPk.mockResolvedValue({
            idBatch: testBatchId,
            scoring_type: 'RAW',
            scoring_config: { initialScore: "10" }
        });

        // 2. Mock User Answers (1 correct)
        useranswer.findAll.mockResolvedValue([
            {
                option: { isCorrect: true },
                question: {
                    group: {
                        section: { idSection: 'sec-1', namaSection: 'Listening' }
                    }
                }
            }
        ]);

        // 3. Mock Result find/update
        const mockResult = {
            id: 'res-789',
            update: jest.fn().mockResolvedValue(true)
        };
        userresult.findByPk.mockResolvedValue(mockResult);

        // Run calculation
        const result = await calculateUserResult(testUserId, testBatchId, 'res-789');
        
        // initialScore (10) + correctCount (1) = 11
        // If fixed with Number(), result should be 11. 
        // If not fixed (string concat), it would be "10" + 1 = "101"
        expect(result.score).toBe(11);
        expect(typeof result.score).toBe('number');
        
        // Verify update was called with number
        expect(mockResult.update).toHaveBeenCalledWith(expect.objectContaining({
            score: 11
        }));
    });

    test('calculateUserResult should handle missing initialScore as 0', async () => {
        batch.findByPk.mockResolvedValue({
            idBatch: testBatchId,
            scoring_type: 'RAW',
            scoring_config: {} // No initialScore
        });

        useranswer.findAll.mockResolvedValue([
            {
                option: { isCorrect: true },
                question: { group: { section: { idSection: 'sec-1', namaSection: 'Listening' } } }
            }
        ]);

        const mockResult = { id: 'res-789', update: jest.fn() };
        userresult.findByPk.mockResolvedValue(mockResult);

        const result = await calculateUserResult(testUserId, testBatchId, 'res-789');
        
        expect(result.score).toBe(1); // 0 + 1
    });
});
