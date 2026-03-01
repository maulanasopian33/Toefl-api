const {
  useranswer,
  option,
  userresult,
  question,
  batch,
  section,
  group,
  scoringdetail,
  scoringtable
} = require('../models');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');
const cache = require('../utils/cache');

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
 * Mencari skor konversi dari database.
 * Jika scoringTableId tidak ada, cari tabel default.
 * 
 * @param {Array} details - Array of scoring details (bulk fetched).
 * @param {number} correctCount - Jumlah jawaban benar.
 * @param {string|null} sectionId - ID Section.
 * @param {string} fallbackCategory - Kategori (listening/structure/reading).
 * @returns {number} - Nilai hasil konversi.
 */
const findScoreInDetails = (details, correctCount, sectionId, fallbackCategory) => {
  // 1. Cari yang match sectionId dan correctCount
  let match = details.find(d => d.section_category === sectionId && d.correct_count === correctCount);
  if (match) return match.converted_score;

  // 2. Cari yang match fallbackCategory (misal 'listening') dan correctCount
  match = details.find(d => d.section_category === fallbackCategory && d.correct_count === correctCount);
  if (match) return match.converted_score;

  // 3. Last fallback (safety score)
  return 20; 
};

/**
 * Mengambil data statistik jawaban (correct/total) per section untuk user.
 * @private
 */
async function _getInternalSectionStats(userId, batchId, resultId = null) {
  const whereClause = { userId, batchId };
  if (resultId) {
    whereClause.userResultId = resultId;
  }

  const answers = await useranswer.findAll({
    where: whereClause,
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

  const sectionMap = {};
  answers.forEach(ans => {
    const sect = ans.question?.group?.section;
    if (!sect) return;

    if (!sectionMap[sect.idSection]) {
      sectionMap[sect.idSection] = {
        id: sect.idSection,
        name: sect.namaSection,
        correct: 0,
        total: 0,
        tableId: sect.scoring_table_id,
        fallback: getFallbackCategory(sect.namaSection)
      };
    }
    sectionMap[sect.idSection].total++;
    if (ans.option?.isCorrect) {
      sectionMap[sect.idSection].correct++;
    }
  });

  return {
    sectionMap,
    totalAnswers: answers.length,
    totalCorrect: Object.values(sectionMap).reduce((sum, s) => sum + s.correct, 0)
  };
}

/**
 * Menghitung skor akhir user untuk satu batch ujian.
 * [MODIFIED] Added resultId to support multiple attempts.
 */
async function calculateUserResult(userId, batchId, resultId = null) {
  try {
    const batchInfo = await batch.findByPk(batchId);
    if (!batchInfo) throw new Error(`Batch ${batchId} tidak ditemukan`);

    const config = batchInfo.scoring_config || {};
    const multiplier = config.multiplier || 10;
    const divisor = config.divisor || 3;

    // 1. Ambil statistik pengerjaan
    // [MODIFIED] filter by resultId if available
    const stats = await _getInternalSectionStats(userId, batchId, resultId);
    const { sectionMap, totalCorrect, totalAnswers } = stats;

    let finalScore = 0;

    if (batchInfo.scoring_type === 'RAW') {
      const initialScore = Number(config.initialScore || 0);
      finalScore = initialScore + totalCorrect;
    } else {
      // 2. Optimization: Bulk Fetch Scoring Details
      const tableIds = Object.values(sectionMap)
        .map(s => s.tableId)
        .filter(id => id !== null);
      
      // Cari ID tabel default jika ada section tanpa tableId
      if (tableIds.length < Object.keys(sectionMap).length) {
        const defaultTable = await scoringtable.findOne({ where: { is_default: true }, attributes: ['id'] });
        if (defaultTable) tableIds.push(defaultTable.id);
      }

      let allDetails = [];
      if (tableIds.length > 0) {
        const cacheKey = `scoring_details_${[...new Set(tableIds)].sort().join('_')}`;
        allDetails = cache.get(cacheKey);

        if (!allDetails) {
          allDetails = await scoringdetail.findAll({
            where: { scoring_table_id: { [Op.in]: [...new Set(tableIds)] } },
            attributes: ['scoring_table_id', 'section_category', 'correct_count', 'converted_score']
          });
          // Cache scoring details selama 1 jam karena data ini jarang berubah
          cache.set(cacheKey, allDetails, 3600);
        }
      }

      // 3. Hitung skor per section
      let totalConverted = 0;
      let usedSectionCount = 0;

      for (const sectionId in sectionMap) {
        const data = sectionMap[sectionId];
        const converted = findScoreInDetails(allDetails, data.correct, data.id, data.fallback);
        totalConverted += converted;
        usedSectionCount++;
      }

      if (usedSectionCount > 0) {
        finalScore = Math.round((totalConverted * multiplier) / divisor);
      } else {
        finalScore = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 677) : 0;
      }
    }

    // 4. Update hasil
    // [MODIFIED] If resultId is provided, we target that specific record
    let targetResult;
    if (resultId) {
      targetResult = await userresult.findByPk(resultId);
    } else {
      // Fallback to legacy behavior (single latest result)
      targetResult = await userresult.findOne({ where: { userId, batchId }, order: [['submittedAt', 'DESC']] });
    }

    if (!targetResult) {
      // Should not happen with new logic, but for safety:
      targetResult = await userresult.create({
        userId, batchId, totalQuestions: totalAnswers,
        correctCount: totalCorrect,
        wrongCount: totalAnswers - totalCorrect,
        score: finalScore,
        submittedAt: new Date(),
        status: 'COMPLETED'
      });
    } else {
      await targetResult.update({
        totalQuestions: totalAnswers,
        correctCount: totalCorrect,
        wrongCount: totalAnswers - totalCorrect,
        score: finalScore,
        // status: updated by Queue Worker, but we could update here too if called synchronously
      });
    }

    logger.info(`Result calculated: User ${userId}, Batch ${batchId}, Result ${resultId || targetResult.id}, Score ${finalScore}`);
    return { userId, batchId, resultId: resultId || targetResult.id, totalQuestions: totalAnswers, correctCount: totalCorrect, score: finalScore };
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
    const stats = await _getInternalSectionStats(userId, batchId);
    const { sectionMap } = stats;

    // Bulk Fetch (sama seperti calculateUserResult)
    const tableIds = Object.values(sectionMap)
      .map(s => s.tableId)
      .filter(id => id !== null);

    const defaultTable = await scoringtable.findOne({ where: { is_default: true }, attributes: ['id'] });
    if (defaultTable) tableIds.push(defaultTable.id);

    let allDetails = [];
    if (tableIds.length > 0) {
      const cacheKey = `scoring_details_${[...new Set(tableIds)].sort().join('_')}`;
      allDetails = cache.get(cacheKey);

      if (!allDetails) {
        allDetails = await scoringdetail.findAll({
          where: { scoring_table_id: { [Op.in]: [...new Set(tableIds)] } },
          attributes: ['scoring_table_id', 'section_category', 'correct_count', 'converted_score']
        });
        cache.set(cacheKey, allDetails, 3600);
      }
    }

    const result = {};
    for (const sid in sectionMap) {
      const data = sectionMap[sid];
      if (scoringType === 'RAW') {
        result[data.name] = data.correct;
      } else {
        result[data.name] = findScoreInDetails(allDetails, data.correct, data.id, data.fallback);
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
  getSectionScores
};
