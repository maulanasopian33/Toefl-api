/**
 * ============================================================
 * PROFESSIONAL SCORING ENGINE — TOEFL/TOAFL Standard
 * ============================================================
 * Implements the ETS-based PBT/ITP scoring model:
 *   - Per-section correct-count → converted score lookup (via DB)
 *   - Final Score = round(sum(section_converted) × 10 / 3)
 *     (Generalized for N sections: weighted proportional average)
 *   - CEFR mapping (A1–C1) at calculation time
 *   - Persistence: section_scores, cefr_level, passed saved to userresult row
 */
'use strict';

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
const cacheService = require('./cache.service');

// ------------------------------------------------------------
// CEFR MAPPING (TOEFL PBT/ITP approximation)
// Range: 310–677
// ------------------------------------------------------------
const CEFR_THRESHOLDS = [
  { min: 627, max: 677, level: 'C1' },
  { min: 543, max: 626, level: 'B2' },
  { min: 460, max: 542, level: 'B1' },
  { min: 337, max: 459, level: 'A2' },
  { min: 0,   max: 336, level: 'A1' },
];

/**
 * Map a total score to a CEFR level.
 * @param {number} score
 * @returns {'A1'|'A2'|'B1'|'B2'|'C1'|'C2'}
 */
const mapCEFR = (score) => {
  for (const range of CEFR_THRESHOLDS) {
    if (score >= range.min && score <= range.max) return range.level;
  }
  return 'A1';
};

// ------------------------------------------------------------
// FALLBACK CATEGORY DETECTION
// ------------------------------------------------------------
const getFallbackCategory = (sectionName) => {
  if (!sectionName) return 'structure';
  const name = sectionName.toLowerCase();
  if (name.includes('listening')) return 'listening';
  if (name.includes('reading')) return 'reading';
  return 'structure';
};

// ------------------------------------------------------------
// SCORING DETAIL LOOKUP (with priority)
// ------------------------------------------------------------
const findScoreInDetails = (details, correctCount, sectionId, fallbackCategory) => {
  // Priority 1: Exact match by sectionId
  let match = details.find(d => String(d.section_category) === String(sectionId) && d.correct_count === correctCount);
  if (match) return { score: match.converted_score, source: 'section_id' };

  // Priority 2: Fallback by generic category (listening/structure/reading)
  match = details.find(d => d.section_category === fallbackCategory && d.correct_count === correctCount);
  if (match) return { score: match.converted_score, source: 'fallback_category' };

  // Priority 3: Proportional fallback (no hardcoded value)
  // Will be handled at the call site since we need correct/total
  return null;
};

// ------------------------------------------------------------
// INTERNAL: Fetch and aggregate answers per section
// ------------------------------------------------------------
async function _getInternalSectionStats(userId, batchId, resultId = null) {
  const whereClause = { userId, batchId };

  // CRITICAL FIX: Strictly filter by resultId when provided (multi-attempt safety)
  if (resultId) {
    whereClause.userResultId = resultId;
  }

  const answers = await useranswer.findAll({
    where: whereClause,
    include: [
      { model: option, as: 'option', attributes: ['isCorrect'] },
      {
        model: question, as: 'question',
        attributes: ['idQuestion'],
        include: [{
          model: group, as: 'group',
          attributes: ['idGroup'],
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
        tableId: sect.scoring_table_id || null,
        fallback: getFallbackCategory(sect.namaSection)
      };
    }
    sectionMap[sect.idSection].total++;
    // Only count as correct if option exists AND isCorrect is true
    if (ans.option && ans.option.isCorrect === true) {
      sectionMap[sect.idSection].correct++;
    }
  });

  return {
    sectionMap,
    totalAnswers: answers.length,
    totalCorrect: Object.values(sectionMap).reduce((sum, s) => sum + s.correct, 0)
  };
}

// ------------------------------------------------------------
// INTERNAL: Bulk-fetch scoring details (cached 1hr)
// ------------------------------------------------------------
async function _bulkFetchScoringDetails(sectionMap) {
  const tableIds = Object.values(sectionMap)
    .map(s => s.tableId)
    .filter(Boolean);

  // Ensure default table is included as last-resort lookup
  const defaultTable = await scoringtable.findOne({ where: { is_default: true }, attributes: ['id'] });
  if (defaultTable && !tableIds.includes(defaultTable.id)) {
    tableIds.push(defaultTable.id);
  }

  if (tableIds.length === 0) return [];

  const uniqueIds = [...new Set(tableIds)].sort();
  const cacheKey = `scoring_details_${uniqueIds.join('_')}`;

  let allDetails = await cacheService.getCache(cacheKey);
  if (!allDetails) {
    allDetails = await scoringdetail.findAll({
      where: { scoring_table_id: { [Op.in]: uniqueIds } },
      attributes: ['scoring_table_id', 'section_category', 'correct_count', 'converted_score'],
      raw: true
    });
    await cacheService.setCache(cacheKey, allDetails, 3600); // Cache 1 hour
  }

  return allDetails;
}

// ------------------------------------------------------------
// CORE CALCULATION: Convert section stats → section scores
// ------------------------------------------------------------
function _calculateSectionScores(sectionMap, allDetails, scoringType, config) {
  const result = {};

  for (const sid in sectionMap) {
    const data = sectionMap[sid];

    if (scoringType === 'RAW') {
      // RAW mode: section score = number of correct answers
      result[data.name] = {
        correct: data.correct,
        total: data.total,
        convertedScore: data.correct,
        percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
        source: 'raw'
      };
    } else {
      // SCALE mode: lookup from scoring table
      const lookup = findScoreInDetails(allDetails, data.correct, data.id, data.fallback);

      let convertedScore;
      if (lookup) {
        convertedScore = lookup.score;
        result[data.name] = {
          correct: data.correct,
          total: data.total,
          convertedScore,
          percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
          source: lookup.source
        };
      } else {
        // Professional fallback: proportional estimation (NO hardcoded 20)
        // TOEFL PBT range per section is approximately 20–68
        const SECTION_MIN = 20;
        const SECTION_MAX = 68;
        convertedScore = data.total > 0
          ? Math.round(SECTION_MIN + ((data.correct / data.total) * (SECTION_MAX - SECTION_MIN)))
          : SECTION_MIN;

        logger.warn(`Scoring lookup MISS: section "${data.name}" (id: ${data.id}), correct: ${data.correct}. Using proportional fallback: ${convertedScore}`);

        result[data.name] = {
          correct: data.correct,
          total: data.total,
          convertedScore,
          percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
          source: 'proportional_fallback'
        };
      }
    }
  }

  return result;
}

// ------------------------------------------------------------
// CORE CALCULATION: section scores → final score
// ------------------------------------------------------------
function _calculateFinalScore(sectionScores, scoringType, config) {
  const sections = Object.values(sectionScores);
  if (sections.length === 0) return 0;

  if (scoringType === 'RAW') {
    const initialScore = Number(config.initialScore || 0);
    const totalCorrect = sections.reduce((sum, s) => sum + s.correct, 0);
    return initialScore + totalCorrect;
  }

  const examStandard = (config.exam_standard || 'TOEFL_PBT').toUpperCase();

  // SCALE mode — Scoring Standard Logic
  const totalConverted = sections.reduce((sum, s) => sum + s.convertedScore, 0);
  const sectionCount = sections.length;

  if (sectionCount === 0) {
    return examStandard === 'TOAFL' ? 0 : 310;
  }

  let finalScore;

  if (examStandard === 'TOAFL') {
    // TOAFL typically uses simple sum. Range: 0-900 (assuming 3 sections of 0-300)
    finalScore = totalConverted;
    return Math.max(0, Math.min(900, finalScore));
  } else {
    // Default: TOEFL PBT formula (standard 310 - 677)
    // FinalScore = round((sumOfConvertedSections × 10) / 3)
    if (sectionCount === 3) {
      finalScore = Math.round((totalConverted * 10) / 3);
    } else {
      // Generalized for N sections
      const avgConverted = totalConverted / sectionCount;
      finalScore = Math.round((avgConverted * 3 * 10) / 3);
    }
    return Math.max(310, Math.min(677, finalScore));
  }
}

// ------------------------------------------------------------
// CORE CALCULATION: Mapping Score → CEFR Level
// ------------------------------------------------------------
function _calculateCEFRLevel(score, config = {}) {
  const examStandard = (config.exam_standard || 'TOEFL_PBT').toUpperCase();

  if (examStandard === 'TOAFL') {
    // Estimasi TOAFL mapping (skala 0-900)
    // Asumsi: proporsional terhadap TOAFL atau standard PTKIN lazimnya:
    if (score >= 750) return 'C1';      // Mahir
    if (score >= 600) return 'B2';      // Lanjut
    if (score >= 450) return 'B1';      // Menengah
    if (score >= 300) return 'A2';      // Dasar
    return 'A1';                        // Pemula
  } else {
    // TOEFL PBT Standard mapping:
    if (score >= 627) return 'C1';
    if (score >= 543) return 'B2';
    if (score >= 460) return 'B1';
    if (score >= 337) return 'A2';
    return 'A1';
  }
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Main scoring function. Calculates user result for a batch attempt.
 * Persists: score, section_scores, cefr_level, passed to userresult row.
 *
 * @param {string} userId
 * @param {string} batchId
 * @param {number|null} resultId - Specific userresult ID for multi-attempt support
 * @returns {object} Calculated result summary
 */
async function calculateUserResult(userId, batchId, resultId = null) {
  try {
    const batchInfo = await batch.findByPk(batchId);
    if (!batchInfo) throw new Error(`Batch ${batchId} tidak ditemukan`);

    let config = batchInfo.scoring_config || {};
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) { config = {}; }
    }

    const scoringType = batchInfo.scoring_type || 'SCALE';
    const passingScore = batchInfo.passing_score || null;

    // Step 1: Fetch section answer stats
    const stats = await _getInternalSectionStats(userId, batchId, resultId);
    const { sectionMap, totalCorrect, totalAnswers } = stats;

    // Step 2: Fetch scoring detail table (bulk, cached)
    const allDetails = await _bulkFetchScoringDetails(sectionMap);

    // Step 3: Calculate per-section scores
    const sectionScores = _calculateSectionScores(sectionMap, allDetails, scoringType, config);

    // Step 4: Calculate final score
    const finalScore = _calculateFinalScore(sectionScores, scoringType, config);

    // Step 5: CEFR & Passing
    const cefrLevel = mapCEFR(finalScore);
    const passed = passingScore !== null ? finalScore >= passingScore : null;

    // Step 6: Build section_scores snapshot (simplified, for DB storage)
    const sectionScoresSnapshot = {};
    for (const [name, data] of Object.entries(sectionScores)) {
      sectionScoresSnapshot[name] = {
        correct: data.correct,
        total: data.total,
        convertedScore: data.convertedScore,
        percentage: data.percentage
      };
    }

    // Step 7: Persist to DB
    let targetResult;
    if (resultId) {
      targetResult = await userresult.findByPk(resultId);
    } else {
      targetResult = await userresult.findOne({
        where: { userId, batchId },
        order: [['submittedAt', 'DESC']]
      });
    }

    const updatePayload = {
      totalQuestions: totalAnswers,
      correctCount: totalCorrect,
      wrongCount: totalAnswers - totalCorrect,
      score: finalScore,
      section_scores: sectionScoresSnapshot,
      cefr_level: cefrLevel,
      passed,
    };

    if (!targetResult) {
      targetResult = await userresult.create({
        userId, batchId,
        ...updatePayload,
        submittedAt: new Date(),
        status: 'COMPLETED'
      });
    } else {
      await targetResult.update(updatePayload);
    }

    logger.info(`[Scoring] User: ${userId} | Batch: ${batchId} | Result: ${resultId || targetResult.id} | Score: ${finalScore} | CEFR: ${cefrLevel} | Passed: ${passed}`);

    return {
      userId,
      batchId,
      resultId: resultId || targetResult.id,
      totalQuestions: totalAnswers,
      correctCount: totalCorrect,
      score: finalScore,
      sectionScores: sectionScoresSnapshot,
      cefrLevel,
      passed
    };
  } catch (err) {
    logger.error(`[Scoring] calculateUserResult Error: ${err.message}`, { userId, batchId, resultId });
    throw err;
  }
}

/**
 * Get per-section scores for display. 
 * Uses persisted data from DB first (fast path).
 * Falls back to recalculation if not yet persisted.
 *
 * @param {string} userId
 * @param {string} batchId
 * @param {string} scoringType
 * @param {object|string} scoringConfig
 * @param {number|null} resultId
 * @returns {object} Map of section name → { correct, total, convertedScore, percentage }
 */
async function getSectionScores(userId, batchId, scoringType, scoringConfig = {}, resultId = null) {
  try {
    // Fast path: check if section_scores already persisted in DB
    const whereClause = { userId, batchId };
    if (resultId) whereClause.id = resultId;

    const persistedResult = await userresult.findOne({
      where: { ...whereClause, status: 'COMPLETED' },
      attributes: ['section_scores'],
      order: [['submittedAt', 'DESC']]
    });

    if (persistedResult?.section_scores && typeof persistedResult.section_scores === 'object') {
      const scores = persistedResult.section_scores;
      const keys = Object.keys(scores);
      if (keys.length > 0) {
        // Normalize: always return flat { sectionName: convertedScore }
        const flat = {};
        for (const [name, val] of Object.entries(scores)) {
          flat[name] = typeof val === 'object' ? (val.convertedScore ?? 0) : Number(val);
        }
        return flat;
      }
    }

    // Slow path: recalculate from answers
    let config = scoringConfig;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) { config = {}; }
    }

    const stats = await _getInternalSectionStats(userId, batchId, resultId);
    const allDetails = await _bulkFetchScoringDetails(stats.sectionMap);
    const sectionScores = _calculateSectionScores(stats.sectionMap, allDetails, scoringType, config);

    // Return flat { sectionName: convertedScore }
    const flat = {};
    for (const [name, data] of Object.entries(sectionScores)) {
      flat[name] = data.convertedScore;
    }
    return flat;
  } catch (err) {
    logger.error(`[Scoring] getSectionScores Error: ${err.message}`);
    return {};
  }
}

/**
 * Get complete certificate-ready data for a user's exam result.
 * Contains all data needed to generate a certificate document.
 *
 * @param {string} userId
 * @param {string} batchId
 * @param {number|null} resultId
 * @returns {object|null}
 */
async function getCertificateData(userId, batchId, resultId = null) {
  try {
    const whereClause = { userId, batchId, status: 'COMPLETED' };
    if (resultId) whereClause.id = resultId;

    const result = await userresult.findOne({
      where: whereClause,
      order: [['submittedAt', 'DESC']],
      include: [
        { model: require('../models').user, as: 'user', attributes: ['uid', 'name', 'email'] },
        { model: require('../models').batch, as: 'batch', attributes: ['idBatch', 'name', 'passing_score', 'scoring_type'] }
      ]
    });

    if (!result) return null;

    // If section_scores not persisted, recalculate and persist now
    let sectionScores = result.section_scores;
    if (!sectionScores || Object.keys(sectionScores).length === 0) {
      logger.warn(`[Scoring] section_scores not found for user ${userId} batch ${batchId}, recalculating...`);
      const calculated = await calculateUserResult(userId, batchId, result.id);
      sectionScores = calculated.sectionScores;
    }

    return {
      resultId: result.id,
      participant: {
        uid: result.user.uid,
        name: result.user.name,
        email: result.user.email
      },
      batch: {
        id: result.batch.idBatch,
        name: result.batch.name,
        scoringType: result.batch.scoring_type,
        passingScore: result.batch.passing_score
      },
      testSummary: {
        totalScore: result.score,
        testDate: result.submittedAt,
        cefrLevel: result.cefr_level || mapCEFR(result.score),
        passed: result.passed,
        totalQuestions: result.totalQuestions,
        correctCount: result.correctCount,
        wrongCount: result.wrongCount
      },
      sectionScores
    };
  } catch (err) {
    logger.error(`[Scoring] getCertificateData Error: ${err.message}`);
    return null;
  }
}

module.exports = {
  calculateUserResult,
  getSectionScores,
  getCertificateData,
  mapCEFR // Export for reuse in controllers
};
