const { calculateUserResult } = require('../services/resultService');
const { sequelize, userAnswer, option, userResult } = require('../models');

describe('Result Service', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Dummy option
    await option.create({ idOption: 'OPT001', questionId: 'Q001', text: 'Benar', isCorrect: true });
    await option.create({ idOption: 'OPT002', questionId: 'Q001', text: 'Salah', isCorrect: false });

    // Dummy jawaban user
    await userAnswer.create({ userId: 1, batchId: 'BATCH001', sectionId: 'SEC001', questionId: 'Q001', optionId: 'OPT001' });
  });

  test('hitung hasil user', async () => {
    const result = await calculateUserResult(1, 'BATCH001');
    expect(result.correctCount).toBe(1);
    expect(result.wrongCount).toBe(0);
    expect(result.score).toBe(100);
  });

  afterAll(async () => {
    await sequelize.close();
  });
});
