const { userAnswer, option, userResult, question } = require('../models');

/**
 * Hitung hasil ujian untuk user dalam batch tertentu
 * @param {number} userId 
 * @param {string} batchId 
 */
async function calculateUserResult(userId, batchId) {
  // Ambil semua jawaban user dalam batch
  const answers = await userAnswer.findAll({
    where: { userId, batchId },
    include: [
      { model: option, as: 'option', attributes: ['idOption', 'isCorrect'] },
      { model: question, as: 'question', attributes: ['idQuestion'] }
    ]
  });

  // Hitung benar/salah
  let correctCount = 0;
  let wrongCount = 0;

  answers.forEach(ans => {
    if (ans.option && ans.option.isCorrect) {
      correctCount++;
    } else {
      wrongCount++;
    }
  });

  const totalQuestions = answers.length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // Simpan ke userResults (upsert)
  const [result, created] = await userResult.findOrCreate({
    where: { userId, batchId },
    defaults: {
      userId,
      batchId,
      totalQuestions,
      correctCount,
      wrongCount,
      score,
      submittedAt: new Date()
    }
  });

  if (!created) {
    await result.update({
      totalQuestions,
      correctCount,
      wrongCount,
      score,
      submittedAt: new Date()
    });
  }

  return { userId, batchId, totalQuestions, correctCount, wrongCount, score };
}

module.exports = { calculateUserResult };
