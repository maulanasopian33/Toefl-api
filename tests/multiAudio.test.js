const db = require('../models');
const { sequelize } = db;
const examController = require('../controllers/examController');

describe('Multi-Audio Group Integration', () => {
    beforeAll(async () => {
        await sequelize.sync();
        
        // Mock user
        await db.user.findOrCreate({
            where: { uid: 'test-user-multi' },
            defaults: {
                email: 'multi-test@example.com',
                name: 'Multi Audio User',
                lastLogin: new Date()
            }
        });

        // Mock batch
        await db.batch.findOrCreate({
            where: { idBatch: 'batch-multi' },
            defaults: {
                name: 'Multi Audio Batch',
                duration_minutes: 60
            }
        });
    });

    test('should save and retrieve multiple audioUrls for a group', async () => {
        const sectionId = 'sec-multi';
        const groupId = 'grp-multi';
        const audioUrls = [
            'https://example.com/audio1.mp3',
            'https://example.com/audio2.mp3',
            'https://example.com/audio3.mp3'
        ];

        // Mock request for updateExamData
        const updateReq = {
            params: { examId: 'batch-multi' },
            body: [
                {
                    id: sectionId,
                    name: 'Listening',
                    instructions: 'Listen to all audios',
                    groups: [
                        {
                            id: groupId,
                            passage: 'Multiple audios here',
                            audioUrls: audioUrls,
                            questions: [
                                {
                                    id: 'q-multi',
                                    question: 'Question?',
                                    type: 'listening',
                                    options: ['A', 'B'],
                                    correctAnswer: 'A'
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
        const instructions = await db.groupaudioinstruction.findAll({
            where: { groupId: groupId },
            order: [['id', 'ASC']]
        });
        expect(instructions.length).toBe(3);
        expect(instructions.map(i => i.audioUrl)).toEqual(audioUrls);

        // Verify via getExamData
        const getReq = {
            params: { examId: 'batch-multi' }
        };
        const getRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        await examController.getExamData(getReq, getRes, jest.fn());
        expect(getRes.status).toHaveBeenCalledWith(200);
        
        const responseData = getRes.json.mock.calls[0][0];
        const retrievedGroup = responseData.data[0].groups[0];
        expect(retrievedGroup.audioUrls).toEqual(audioUrls);

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
        const sectionGroup = sectionData.groups[0];
        expect(sectionGroup.audioUrls).toEqual(audioUrls);
    });

    afterAll(async () => {
        // Cleanup
        await db.option.destroy({ where: { idOption: { [db.Sequelize.Op.like]: 'opt-q-multi%' } } });
        await db.question.destroy({ where: { idQuestion: 'q-multi' } });
        await db.groupaudioinstruction.destroy({ where: { groupId: 'grp-multi' } });
        await db.group.destroy({ where: { idGroup: 'grp-multi' } });
        await db.section.destroy({ where: { idSection: 'sec-multi' } });
        await db.batch.destroy({ where: { idBatch: 'batch-multi' } });
        await db.user.destroy({ where: { uid: 'test-user-multi' } });
        await sequelize.close();
    });
});
