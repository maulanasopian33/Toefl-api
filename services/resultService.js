const {
  useranswer,
  option,
  userresult,
  question,
  batch,
  section,
  group,
  scoringdetail
} = require('../models');
const { logger } = require('../utils/logger');

/**
 * Fallback tabel konversi TOEFL ITP standar.
 * Digunakan jika tidak ada tabel konversi yang didefinisikan di database.
 */
const DEFAULT_CONVERSION_TABLES = {
  listening: [24, 25, 26, 27, 29, 30, 31, 32, 32, 33, 35, 37, 37, 38, 41, 41, 42, 43, 44, 45, 45, 46, 47, 48, 49, 49, 50, 51, 52, 53, 54, 54, 55, 56, 57, 57, 58, 59, 60, 61, 62, 63, 65, 66, 67, 67, 68],
  structure: [20, 20, 21, 22, 23, 25, 26, 27, 29, 31, 33, 35, 36, 37, 38, 40, 40, 41, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 60, 61, 63, 65, 67, 68],
  reading: [21, 22, 23, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 43, 44, 45, 46, 46, 47, 48, 49, 50, 51, 52, 52, 53, 54, 54, 55, 56, 57, 58, 59, 60, 61, 63, 65, 66, 67],
};

/**
 * Mencari skor konversi dari database berdasarkan idSection atau fallback ke default.
 * 
 * @param {number} correctCount - Jumlah jawaban benar.
 * @param {string} sectionId - ID Section untuk lookup di scoring_details.
 * @param {number|null} scoringTableId - ID Tabel Scoring (opsional).
 * @param {string} fallbackType - Tipe fallback jika DB tidak ketemu (listening/structure/reading).
 * @returns {Promise<number>} - Nilai hasil konversi.
 */
const getConvertedScore = async (correctCount, sectionId, scoringTableId = null, fallbackType = 'structure') => {
  try {
    if (scoringTableId) {
      const detail = await scoringdetail.findOne({
        where: {
          scoring_table_id: scoringTableId,
          section_category: sectionId,
          correct_count: correctCount
        }
      });

      if (detail) return detail.converted_score;
    }

    // Fallback ke tabel hardcoded jika data di DB tidak ada
    const table = DEFAULT_CONVERSION_TABLES[fallbackType] || DEFAULT_CONVERSION_TABLES['structure'];

    // Safety check untuk index array
    if (correctCount <= 0) return table[0] || 20;
    if (correctCount >= table.length) return table[table.length - 1] || 68;
    return table[correctCount - 1] || 20;
  } catch (err) {
    logger.error(`Error in getConvertedScore: ${err.message}`, { sectionId, correctCount });
    return 20; // Default safety score
  }
};

/**
 * Mendapatkan kategori fallback (listening/structure/reading) berdasarkan nama section.
 */
const getFallbackCategory = (sectionName) => {
  if (!sectionName) return 'structure';
  const name = sectionName.toLowerCase();
  if (name.includes('listening')) return 'listening';
  if (name.includes('reading')) return 'reading';
  return 'structure';
};

/**
 * Menghitung skor akhir user untuk satu batch ujian.
 */
async function calculateUserResult(userId, batchId) {
  try {
    const batchInfo = await batch.findByPk(batchId);
    if (!batchInfo) throw new Error(`Batch ${batchId} tidak ditemukan`);

    const config = batchInfo.scoring_config || {};
    const multiplier = config.multiplier || 10;
    const divisor = config.divisor || 3;

    // Ambil jawaban beserta info section (scoring_table_id)
    const answers = await useranswer.findAll({
      where: { userId, batchId },
      include: [
        { model: option, as: 'option', attributes: ['isCorrect'] },
        {
          model: question, as: 'question',
          include: [{
            model: group, as: 'group',
            include: [{
              model: section, as: 'section',
              attributes: ['idSection', 'namaSection', 'scoring_table_id']
            }]
          }]
        }
      ]
    });

    if (answers.length === 0) {
      logger.warn(`User ${userId} tidak memiliki jawaban di batch ${batchId}`);
      // Tetap lanjutkan untuk reset score jika sebelumnya ada
    }

    let totalCorrect = 0;
    const sectionDataMap = {};

    answers.forEach(ans => {
      const isCorrect = ans.option?.isCorrect || false;
      const sect = ans.question?.group?.section;

      if (sect) {
        if (!sectionDataMap[sect.idSection]) {
          sectionDataMap[sect.idSection] = {
            id: sect.idSection,
            correct: 0,
            name: sect.namaSection,
            tableId: sect.scoring_table_id,
            fallback: getFallbackCategory(sect.namaSection)
          };
        }
        if (isCorrect) {
          sectionDataMap[sect.idSection].correct++;
          totalCorrect++;
        }
      } else if (isCorrect) {
        totalCorrect++;
      }
    });

    let finalScore = 0;
    if (batchInfo.scoring_type === 'RAW') {
      finalScore = (config.initialScore || 0) + totalCorrect;
    } else {
      let totalConverted = 0;
      let usedSectionCount = 0;

      for (const sectionId in sectionDataMap) {
        const data = sectionDataMap[sectionId];
        const converted = await getConvertedScore(data.correct, data.id, data.tableId, data.fallback);
        totalConverted += converted;
        usedSectionCount++;
      }

      if (usedSectionCount > 0) {
        finalScore = Math.round((totalConverted * multiplier) / divisor);
      } else {
        finalScore = answers.length > 0 ? Math.round((totalCorrect / answers.length) * 677) : 0;
      }
    }

    // Upsert hasil
    const totalQuestions = answers.length;
    const [userRes, created] = await userresult.findOrCreate({
      where: { userId, batchId },
      defaults: {
        userId, batchId, totalQuestions,
        correctCount: totalCorrect,
        wrongCount: totalQuestions - totalCorrect,
        score: finalScore,
        submittedAt: new Date()
      }
    });

    if (!created) {
      await userRes.update({
        totalQuestions,
        correctCount: totalCorrect,
        wrongCount: totalQuestions - totalCorrect,
        score: finalScore,
        submittedAt: new Date()
      });
    }

    logger.info(`Result calculated: User ${userId}, Batch ${batchId}, Score ${finalScore}`);
    return { userId, batchId, totalQuestions, correctCount: totalCorrect, score: finalScore };
  } catch (err) {
    logger.error(`calculateUserResult Error: ${err.message}`, { userId, batchId });
    throw err;
  }
}

/**
 * Helper untuk mendapatkan detail skor per section (digunakan Controller)
 */
async function getSectionScores(userId, batchId, scoringType, scoringConfig = {}) {
  try {
    const answers = await useranswer.findAll({
      where: { userId, batchId },
      include: [
        { model: option, as: 'option', attributes: ['isCorrect'] },
        {
          model: question, as: 'question',
          include: [{
            model: group, as: 'group',
            include: [{ model: section, as: 'section' }]
          }]
        }
      ]
    });

    const sections = {};
    answers.forEach(ans => {
      const sect = ans.question?.group?.section;
      if (!sect) return;

      if (!sections[sect.idSection]) {
        sections[sect.idSection] = {
          id: sect.idSection,
          name: sect.namaSection,
          correct: 0,
          tableId: sect.scoring_table_id,
          fallback: getFallbackCategory(sect.namaSection)
        };
      }
      if (ans.option?.isCorrect) {
        sections[sect.idSection].correct++;
      }
    });

    const result = {};
    for (const sid in sections) {
      const data = sections[sid];
      if (scoringType === 'RAW') {
        result[data.name] = data.correct;
      } else {
        result[data.name] = await getConvertedScore(data.correct, data.id, data.tableId, data.fallback);
      }
    }
    return result;
  } catch (err) {
    logger.error(`getSectionScores Error: ${err.message}`);
    return {};
  }
}

module.exports = {
  calculateUserResult,
  getConvertedScore,
  getSectionScores
};
