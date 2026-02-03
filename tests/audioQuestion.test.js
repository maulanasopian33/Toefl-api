const db = require('../models');
const { sequelize } = db;
const examController = require('../controllers/examController');

describe('Audio Question Integration', () => {
    let transaction;

    beforeAll(async () => {
        // Use sync with force: false to keep current schema (migration already run)
        // For testing, we might want to sync if it's a clean test DB, 
        // but here we assume the migration is already applied to the DB sequelize is connecting to.
        await sequelize.sync();
        
        // Mock user
        await db.user.findOrCreate({
            where: { uid: 'test-user-audio' },
            defaults: {
                email: 'audio-test@example.com',
                name: 'Audio Test User',
                lastLogin: new Date()
            }
        });

        // Mock batch
        await db.batch.findOrCreate({
            where: { idBatch: 'batch-audio' },
            defaults: {
                name: 'Audio Test Batch',
                duration_minutes: 60
            }
        });
    });

    test('should save and retrieve audioUrl for a question', async () => {
        const sectionId = 'sec-audio';
        const groupId = 'grp-audio';
        const questionId = 'q-audio';
        const audioUrl = 'https://example.com/audio.mp3';

        // Mock request for updateExamData
        const updateReq = {
            params: { examId: 'batch-audio' },
            body: [
                {
                    id: sectionId,
                    name: 'Listening',
                    instructions: 'Listen carefully',
                    groups: [
                        {
                            id: groupId,
                            passage: 'Some passage',
                            questions: [
                                {
                                    id: questionId,
                                    question: 'What is the audio about?',
                                    type: 'listening',
                                    audioUrl: audioUrl,
                                    options: ['Option 1', 'Option 2'],
                                    correctAnswer: 'Option 1'
                                }
                            ]
                        }
                    ]
                }
            ],
            user: { email: 'admin@example.com' }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        await examController.updateExamData(updateReq, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(200);

        // Verify in DB directly
        const question = await db.question.findByPk(questionId);
        expect(question.audioUrl).toBe(audioUrl);

        // Verify via getExamData
        const getReq = {
            params: { examId: 'batch-audio' }
        };
        const getRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        await examController.getExamData(getReq, getRes, jest.fn());
        expect(getRes.status).toHaveBeenCalledWith(200);
        
        const responseData = getRes.json.mock.calls[0][0];
        const retrievedQuestion = responseData.data[0].groups[0].questions[0];
        expect(retrievedQuestion.audioUrl).toBe(audioUrl);

        // Verify via getSectionData
        const sectionReq = {
            params: { sectionId: sectionId }
        };
        const sectionRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        await examController.getSectionData(sectionReq, sectionRes, jest.fn());
        expect(sectionRes.status).toHaveBeenCalledWith(200);
        
        const sectionData = sectionRes.json.mock.calls[0][0];
        const sectionQuestion = sectionData.groups[0].questions[0];
        expect(sectionQuestion.audioUrl).toBe(audioUrl);
    });

    afterAll(async () => {
        // Cleanup
        await db.option.destroy({ where: { questionId: 'q-audio' } });
        await db.question.destroy({ where: { idQuestion: 'q-audio' } });
        await db.group.destroy({ where: { idGroup: 'grp-audio' } });
        await db.section.destroy({ where: { idSection: 'sec-audio' } });
        await db.batch.destroy({ where: { idBatch: 'batch-audio' } });
        await db.user.destroy({ where: { uid: 'test-user-audio' } });
        await sequelize.close();
    });
});
