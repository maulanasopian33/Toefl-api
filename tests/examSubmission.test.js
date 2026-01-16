const db = require('../models');
const { sequelize } = db;
const examController = require('../controllers/examController');
const crypto = require('crypto');

describe('Exam Submission Integration', () => {
    let transaction;

    beforeAll(async () => {
        // Ensure database is in test state
        await sequelize.sync({ force: true });
        
        // Mock user
        await db.user.create({
            uid: 'test-user-123',
            email: 'test@example.com',
            name: 'Test User',
            lastLogin: new Date()
        });

        // Mock batch
        await db.batch.create({
            idBatch: 'batch-001',
            name: 'TOEFL Test 1',
            duration_minutes: 120
        });

        // Mock section
        await db.section.create({
            idSection: 'sec-1',
            namaSection: 'Structure',
            batchId: 'batch-001'
        });

        // Mock group
        await db.group.create({
            idGroup: 'grp-1',
            sectionId: 'sec-1',
            batchId: 'batch-001'
        });
    });

    test('should correctly score answers with long similar options', async () => {
        const questionId = 'q-1';
        const correctAnswerText = 'The quick brown fox jumps over the lazy dog';
        const wrongAnswerText = 'The quick brown fox jumps over the lazy cat';
        
        // Create question
        await db.question.create({
            idQuestion: questionId,
            text: 'Choose the correct sentence:',
            groupId: 'grp-1',
            type: 'structure'
        });

        // Generate options using the same logic as controller
        const hashCorrect = crypto.createHash('md5').update(correctAnswerText.trim()).digest('hex').substring(0, 8);
        const idCorrect = `opt-${questionId}-0-${hashCorrect}`;

        const hashWrong = crypto.createHash('md5').update(wrongAnswerText.trim()).digest('hex').substring(0, 8);
        const idWrong = `opt-${questionId}-1-${hashWrong}`;

        await db.option.bulkCreate([
            { idOption: idCorrect, text: correctAnswerText, isCorrect: true, questionId: questionId },
            { idOption: idWrong, text: wrongAnswerText, isCorrect: false, questionId: questionId }
        ]);

        // Mock request for submit
        const req = {
            params: { testId: 'batch-001' },
            body: {
                answers: [
                    { questionId: questionId, userAnswer: idCorrect } // User answers correctly
                ]
            },
            user: { uid: 'test-user-123' }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        const next = jest.fn();

        await examController.submitTest(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        const responseData = res.json.mock.calls[0][0];
        expect(responseData.correctCount).toBe(1);
        expect(responseData.score).toBe(1); // Currently score = correctCount in submitTest
    });

    test('should return 0 score for wrong answer', async () => {
        const questionId = 'q-2';
        const correctAnswer = 'Correct';
        const wrongAnswer = 'Wrong';

        await db.question.create({ idQuestion: questionId, text: 'Q2', groupId: 'grp-1' });
        
        const idCorrect = `opt-${questionId}-0-${crypto.createHash('md5').update(correctAnswer).digest('hex').substring(0, 8)}`;
        const idWrong = `opt-${questionId}-1-${crypto.createHash('md5').update(wrongAnswer).digest('hex').substring(0, 8)}`;

        await db.option.bulkCreate([
            { idOption: idCorrect, text: correctAnswer, isCorrect: true, questionId: questionId },
            { idOption: idWrong, text: wrongAnswer, isCorrect: false, questionId: questionId }
        ]);

        const req = {
            params: { testId: 'batch-001' },
            body: {
                answers: [{ questionId: questionId, userAnswer: idWrong }]
            },
            user: { uid: 'test-user-123' }
        };

        const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
        await examController.submitTest(req, res, jest.fn());

        expect(res.json.mock.calls[0][0].correctCount).toBe(0);
    });

    afterAll(async () => {
        await sequelize.close();
    });
});
