const { sequelize, user, batch, question, option, userAnswer, userResult } = require('../models');

beforeAll(async () => {
  await sequelize.sync({ force: true }); // reset DB untuk testing
});

afterAll(async () => {
  await sequelize.close();
});

describe('userAnswer Hooks', () => {
  let testUser, testBatch, testQuestion, optionCorrect, optionWrong;

  beforeEach(async () => {
    // Reset setiap test
    await sequelize.sync({ force: true });

    // Dummy data
    testUser = await user.create({ name: 'Test User' });
    testBatch = await batch.create({ idBatch: 'B1', namaBatch: 'Batch 1' });
    testQuestion = await question.create({ text: 'Apa ibukota Indonesia?', batchId: 'B1' });

    optionCorrect = await option.create({ text: 'Jakarta', isCorrect: true, questionId: testQuestion.id });
    optionWrong = await option.create({ text: 'Bandung', isCorrect: false, questionId: testQuestion.id });
  });

  test('✅ afterCreate menambah jawaban benar ke userResult', async () => {
    await userAnswer.create({
      userId: testUser.id,
      batchId: testBatch.idBatch,
      questionId: testQuestion.id,
      optionId: optionCorrect.id,
    });

    const result = await userResult.findOne({ where: { userId: testUser.id, batchId: 'B1' } });
    expect(result.correctCount).toBe(1);
    expect(result.wrongCount).toBe(0);
    expect(result.score).toBe(10);
  });

  test('✅ afterCreate menambah jawaban salah ke userResult', async () => {
    await userAnswer.create({
      userId: testUser.id,
      batchId: testBatch.idBatch,
      questionId: testQuestion.id,
      optionId: optionWrong.id,
    });

    const result = await userResult.findOne({ where: { userId: testUser.id, batchId: 'B1' } });
    expect(result.correctCount).toBe(0);
    expect(result.wrongCount).toBe(1);
    expect(result.score).toBe(0);
  });

  test('✅ afterUpdate memperbarui dari salah → benar', async () => {
    const ans = await userAnswer.create({
      userId: testUser.id,
      batchId: testBatch.idBatch,
      questionId: testQuestion.id,
      optionId: optionWrong.id,
    });

    // Update jawaban ke benar
    ans.optionId = optionCorrect.id;
    await ans.save();

    const result = await userResult.findOne({ where: { userId: testUser.id, batchId: 'B1' } });
    expect(result.correctCount).toBe(1);
    expect(result.wrongCount).toBe(0);
    expect(result.score).toBe(10);
  });

  test('✅ afterUpdate memperbarui dari benar → salah', async () => {
    const ans = await userAnswer.create({
      userId: testUser.id,
      batchId: testBatch.idBatch,
      questionId: testQuestion.id,
      optionId: optionCorrect.id,
    });

    // Update jawaban ke salah
    ans.optionId = optionWrong.id;
    await ans.save();

    const result = await userResult.findOne({ where: { userId: testUser.id, batchId: 'B1' } });
    expect(result.correctCount).toBe(0);
    expect(result.wrongCount).toBe(1);
    expect(result.score).toBe(0);
  });

  test('✅ afterUpdate tidak mengubah result jika tetap sama', async () => {
    const ans = await userAnswer.create({
      userId: testUser.id,
      batchId: testBatch.idBatch,
      questionId: testQuestion.id,
      optionId: optionCorrect.id,
    });

    // Update ke jawaban yang sama (tidak berubah status benar/salah)
    ans.optionId = optionCorrect.id;
    await ans.save();

    const result = await userResult.findOne({ where: { userId: testUser.id, batchId: 'B1' } });
    expect(result.correctCount).toBe(1);
    expect(result.wrongCount).toBe(0);
    expect(result.score).toBe(10);
  });
});
