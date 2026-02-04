const db = require('../models');
const examController = require('../controllers/examController');
const sectionController = require('../controllers/sectionController');

jest.mock('../models', () => {
    return {
        sequelize: {
            transaction: jest.fn(() => ({
                commit: jest.fn(),
                rollback: jest.fn(),
            })),
        },
        section: {
            bulkCreate: jest.fn(),
            findAll: jest.fn(),
            destroy: jest.fn(),
            findByPk: jest.fn(),
        },
        batch: {
            findByPk: jest.fn(),
        },
        userresult: {
            count: jest.fn(),
        },
        group: {
            bulkCreate: jest.fn(),
            destroy: jest.fn(),
        },
        question: {
            findAll: jest.fn(),
            bulkCreate: jest.fn(),
            destroy: jest.fn(),
        },
        option: {
            bulkCreate: jest.fn(),
            destroy: jest.fn(),
        },
        groupaudioinstruction: {
            destroy: jest.fn(),
            bulkCreate: jest.fn(),
        },
        sectionaudioinstruction: {
            destroy: jest.fn(),
            bulkCreate: jest.fn(),
        },
        useranswer: {
            bulkCreate: jest.fn(),
        }
    };
});

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe('Section Ordering', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            params: { examId: 'batch-123', testId: 'batch-123' },
            body: [],
            user: { email: 'admin@test.com' }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    test('updateExamData should assign urutan based on array index', async () => {
        req.body = [
            { id: 'sec-B', name: 'Section B', instructions: '', groups: [] },
            { id: 'sec-A', name: 'Section A', instructions: '', groups: [] }
        ];

        db.batch.findByPk.mockResolvedValue({ start_date: null });
        db.userresult.count.mockResolvedValue(0);
        db.section.bulkCreate.mockResolvedValue([]);
        db.group.bulkCreate.mockResolvedValue([]);
        db.group.destroy.mockResolvedValue(0);
        db.section.destroy.mockResolvedValue(0);
        db.option.destroy.mockResolvedValue(0);
        db.question.findAll.mockResolvedValue([]);
        db.question.bulkCreate.mockResolvedValue([]);

        await examController.updateExamData(req, res, next);

        expect(db.section.bulkCreate).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ idSection: 'sec-B', urutan: 1 }),
                expect.objectContaining({ idSection: 'sec-A', urutan: 2 })
            ]),
            expect.any(Object)
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('getExamData should order by urutan ASC', async () => {
        db.batch.findByPk.mockResolvedValue({ start_date: null });
        db.userresult.count.mockResolvedValue(0);
        db.section.findAll.mockResolvedValue([]);

        await examController.getExamData(req, res, next);

        expect(db.section.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                order: expect.arrayContaining([
                    ['urutan', 'ASC']
                ])
            })
        );
    });

    test('sectionController.getAll should order by urutan ASC', async () => {
        db.section.findAll.mockResolvedValue([]);

        await sectionController.getAll(req, res);

        expect(db.section.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                order: [['urutan', 'ASC']]
            })
        );
    });
});
