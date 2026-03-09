const { 
  userresult, 
  useranswer, 
  question, 
  option, 
  batch, 
  user,
  section,
  group,
  sequelize 
} = require('../models');
const { Op } = require('sequelize');
const { jsonToCsv } = require('../utils/csvGenerator');
const { getCache, setCache } = require('../services/cache.service');
const { getSectionScores } = require('../services/resultService');

const CACHE_TTL = 300; // 5 minutes

// Helper to handle response or CSV export
const sendResponse = (req, res, data, csvFilename, csvTransformer) => {
  if (req.query.export === 'csv') {
    const csvData = csvTransformer ? csvTransformer(data) : data;
    const csv = jsonToCsv(csvData);
    
    // Prepend UTF-8 BOM to fix Arabic/Special characters in Excel
    const csvWithBOM = '\uFEFF' + csv;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${csvFilename}.csv"`);
    return res.status(200).send(csvWithBOM);
  }
  return res.status(200).json({ status: true, data });
};

// 1. Participant Results
exports.getParticipantResults = async (req, res, next) => {
  try {
    const { batchId, date, search, page = 1, limit = 10 } = req.query;
    
    // Setup where clauses
    const whereClause = {};
    if (batchId) whereClause.batchId = batchId;
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      whereClause.submittedAt = { [Op.between]: [startDate, endDate] };
    }

    const userWhere = {};
    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    // Pagination for JSON, but ALL data for CSV
    const isExport = req.query.export === 'csv';
    const offset = (page - 1) * limit;
    
    const queryOptions = {
      where: whereClause,
      include: [
        { model: user, as: 'user', attributes: ['uid', 'name', 'email'], where: userWhere, required: true },
        { model: batch, as: 'batch', attributes: ['idBatch', 'name', 'scoring_type', 'scoring_config'] }
      ],
      order: [['score', 'DESC']]
    };

    if (!isExport) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = parseInt(offset);
      queryOptions.distinct = true; // Use distinct when including other tables to get accurate count
      
      const { count, rows } = await userresult.findAndCountAll(queryOptions);
      
      const formattedRows = await Promise.all(rows.map(async (row) => {
        const sectionScores = await getSectionScores(row.user.uid, row.batch.idBatch, row.batch.scoring_type, row.batch.scoring_config);
        const data = row.toJSON();
        data.sectionScores = sectionScores;
        return data;
      }));

      const responseData = {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        results: formattedRows
      };
      return res.status(200).json({ status: true, data: responseData });
    } else {
      const results = await userresult.findAll({ ...queryOptions }); // remove raw to use model instances for getSectionScores
      
      const formattedCSV = await Promise.all(results.map(async (r) => {
        const sectionScores = await getSectionScores(r.user.uid, r.batch.idBatch, r.batch.scoring_type, r.batch.scoring_config);
        
        const baseData = {
          participant_id: r.user.uid,
          participant_name: r.user.name,
          email: r.user.email,
          batch_id: r.batch.idBatch,
          batch_name: r.batch.name,
          test_date: r.submittedAt,
        };
        
        if (sectionScores) {
          Object.keys(sectionScores).forEach(key => {
            baseData[`section_${key.toLowerCase().replace(/\s+/g, '_')}`] = sectionScores[key];
          });
        }
        
        baseData.total_score = r.score;
        baseData.correct_answers = r.correctCount;
        baseData.wrong_answers = r.wrongCount;
        baseData.status = r.status;
        
        return baseData;
      }));
      
      return sendResponse(req, res, formattedCSV, 'participant_test_results');
    }
  } catch (error) {
    next(error);
  }
};

// 2. Answer Details
exports.getAnswerDetails = async (req, res, next) => {
  try {
    const { participantId, sectionId, isCorrect, batchId } = req.query;
    
    const whereClause = {};
    if (participantId) whereClause.userId = participantId;
    if (sectionId) whereClause.sectionId = sectionId;
    if (batchId) whereClause.batchId = batchId;

    const includeOptions = [
      { model: user, as: 'user', attributes: ['uid', 'name'], required: true },
      { model: batch, as: 'batch', attributes: ['idBatch', 'name'], required: true },
      { model: section, as: 'section', attributes: ['idSection', 'namaSection'], required: true },
      { model: question, as: 'question', attributes: ['idQuestion', 'text'], required: true },
      { model: option, as: 'option', attributes: ['idOption', 'text', 'isCorrect'], required: false } // option might be null if user didn't answer
    ];

    if (isCorrect !== undefined) {
      includeOptions[4].where = { isCorrect: isCorrect === 'true' || isCorrect === '1' };
    }

    const answers = await useranswer.findAll({
      where: whereClause,
      include: includeOptions,
      limit: req.query.export === 'csv' ? null : 1000, // Limit JSON to avoid large payload, allow all for CSV
    });

    const formattedAnswers = answers.map(a => ({
      participant_id: a.user.uid,
      participant_name: a.user.name,
      batch_id: a.batch.idBatch,
      batch_name: a.batch.name,
      section: a.section.namaSection,
      question_id: a.question ? a.question.idQuestion : null,
      question_text: a.question ? a.question.text : null, // Simplified for brevity instead of number
      selected_option: a.option ? a.option.text : null,
      is_correct: a.option ? (a.option.isCorrect ? 'Yes' : 'No') : 'No'
    }));

    return sendResponse(req, res, formattedAnswers, 'participant_answers_detail');
  } catch (error) {
    console.error('Answer details error:', error);
    next(error);
  }
};

// 3. Question Quality
exports.getQuestionQuality = async (req, res, next) => {
  try {
    const { batchId, sectionId } = req.query;
    const whereClause = {};
    if (batchId) whereClause.batchId = batchId;
    
    const sectionWhere = sectionId ? { idSection: sectionId } : {};

    const qualityStats = await useranswer.findAll({
      where: whereClause,
      attributes: [
        [sequelize.col('question.idQuestion'), 'question_id'],
        [sequelize.col('question.text'), 'question_text'],
        [sequelize.col('section.namaSection'), 'section_name'],
        [sequelize.fn('COUNT', sequelize.col('useranswer.id')), 'total_attempts'],
        [
          sequelize.fn('SUM', sequelize.literal('CASE WHEN option.isCorrect = 1 THEN 1 ELSE 0 END')), 
          'correct_count'
        ],
        [
          sequelize.fn('SUM', sequelize.literal('CASE WHEN option.isCorrect = 0 THEN 1 ELSE 0 END')), 
          'wrong_count'
        ],
      ],
      include: [
        { model: question, as: 'question', attributes: [], required: true },
        { model: section, as: 'section', attributes: [], where: sectionWhere, required: true },
        { model: option, as: 'option', attributes: [], required: true }
      ],
      group: ['question.idQuestion', 'question.text', 'section.namaSection'],
      raw: true
    });

    const formattedQuality = qualityStats.map(q => {
      const difficultyIndex = q.total_attempts > 0 ? (q.correct_count / q.total_attempts).toFixed(2) : 0;
      let interpretation = '';
      if (difficultyIndex >= 0.8) interpretation = 'Sangat Mudah';
      else if (difficultyIndex >= 0.6) interpretation = 'Mudah';
      else if (difficultyIndex >= 0.4) interpretation = 'Sedang';
      else if (difficultyIndex >= 0.2) interpretation = 'Sulit';
      else interpretation = 'Sangat Sulit';

      return {
        question_id: q.question_id,
        // clean html tags from question text for report
        question_text: q.question_text ? q.question_text.replace(/<[^>]+>/g, '').substring(0, 100) : '',
        section: q.section_name,
        total_attempts: parseInt(q.total_attempts),
        correct_count: parseInt(q.correct_count),
        wrong_count: parseInt(q.wrong_count),
        difficulty_index: parseFloat(difficultyIndex),
        interpretation
      };
    });

    return sendResponse(req, res, formattedQuality, 'question_analysis');
  } catch (error) {
    next(error);
  }
};

// 4. Option Distribution
exports.getOptionDistribution = async (req, res, next) => {
  try {
    const { questionId, sectionId } = req.query;
    const whereClause = {};
    if (questionId) whereClause.questionId = questionId;
    if (sectionId) whereClause.sectionId = sectionId;

    const distribution = await useranswer.findAll({
      where: whereClause,
      attributes: [
        [sequelize.col('question.idQuestion'), 'question_id'],
        [sequelize.col('section.namaSection'), 'section_name'],
        [sequelize.col('option.idOption'), 'option_id'],
        [sequelize.col('option.text'), 'option_text'],
        [sequelize.col('option.isCorrect'), 'is_correct'],
        [sequelize.fn('COUNT', sequelize.col('useranswer.id')), 'selected_count']
      ],
      include: [
        { model: question, as: 'question', attributes: [], required: true },
        { model: section, as: 'section', attributes: [], required: true },
        { model: option, as: 'option', attributes: [], required: true }
      ],
      group: [
        'question.idQuestion', 
        'section.namaSection', 
        'option.idOption', 
        'option.text', 
        'option.isCorrect'
      ],
      raw: true
    });

    // Calculate percentage per question
    const questionTotals = {};
    distribution.forEach(d => {
      if (!questionTotals[d.question_id]) questionTotals[d.question_id] = 0;
      questionTotals[d.question_id] += parseInt(d.selected_count);
    });

    const formattedDist = distribution.map(d => ({
      question_id: d.question_id,
      section: d.section_name,
      option: d.option_text ? d.option_text.replace(/<[^>]+>/g, '').substring(0, 50) : '',
      selected_count: parseInt(d.selected_count),
      percentage: questionTotals[d.question_id] > 0 
        ? ((d.selected_count / questionTotals[d.question_id]) * 100).toFixed(2) + '%' 
        : '0%',
      is_correct: d.is_correct ? 'Yes' : 'No'
    }));

    return sendResponse(req, res, formattedDist, 'question_option_distribution');
  } catch (error) {
    next(error);
  }
};

// 5. Participant Progress
exports.getParticipantProgress = async (req, res, next) => {
  try {
    const { participantId } = req.query;
    
    const progressOptions = {
      where: { status: 'COMPLETED' },
      include: [
        { model: user, as: 'user', attributes: ['uid', 'name'] },
        { model: batch, as: 'batch', attributes: ['idBatch', 'name'] }
      ],
      order: [['submittedAt', 'ASC']],
      raw: true,
      nest: true
    };
    
    if (participantId) {
       progressOptions.where.userId = participantId;
    }
    
    const progress = await userresult.findAll(progressOptions);

    const formattedProgress = progress.map(p => ({
      participant_id: p.user.uid,
      participant_name: p.user.name,
      test_date: p.submittedAt,
      batch_name: p.batch.name,
      total_score: p.score
    }));

    return sendResponse(req, res, formattedProgress, 'participant_progress');
  } catch (error) {
    next(error);
  }
};

// 6. Batch Statistics
exports.getBatchStatistics = async (req, res, next) => {
  try {
    const { batchId } = req.query;
    const whereClause = { status: 'COMPLETED' };
    if (batchId) whereClause.batchId = batchId;

    const stats = await userresult.findAll({
      where: whereClause,
      attributes: [
        [sequelize.col('batch.idBatch'), 'batch_id'],
        [sequelize.col('batch.name'), 'batch_name'],
        [sequelize.fn('COUNT', sequelize.col('userresult.id')), 'total_participants'],
        [sequelize.fn('AVG', sequelize.col('score')), 'avg_total_score'],
        [sequelize.fn('MAX', sequelize.col('score')), 'max_score'],
        [sequelize.fn('MIN', sequelize.col('score')), 'min_score'],
      ],
      include: [
        { model: batch, as: 'batch', attributes: [], required: true }
      ],
      group: ['batch.idBatch', 'batch.name'],
      raw: true
    });

    // Pass rate logic (Assuming score >= 450 is pass)
    for (let stat of stats) {
      const passedCount = await userresult.count({
        where: {
          batchId: stat.batch_id,
          status: 'COMPLETED',
          score: { [Op.gte]: 450 }
        }
      });
      stat.pass_rate = stat.total_participants > 0 
        ? ((passedCount / stat.total_participants) * 100).toFixed(2) + '%' 
        : '0%';
        
      stat.avg_total_score = Math.round(stat.avg_total_score);
    }

    return sendResponse(req, res, stats, 'batch_statistics');
  } catch (error) {
    next(error);
  }
};

// 7. Diagnostic Report (Individual Radar & CEFR)
exports.getDiagnosticReport = async (req, res, next) => {
  try {
    const { participantId, batchId } = req.query;
    if (!participantId || !batchId) {
      return res.status(400).json({ status: false, message: 'participantId dan batchId wajib diisi.' });
    }

    // 1. Get participant's result
    const participantResult = await userresult.findOne({
      where: { userId: participantId, batchId: batchId, status: 'COMPLETED' },
      include: [
        { model: user, as: 'user', attributes: ['uid', 'name', 'email'] },
        { model: batch, as: 'batch', attributes: ['idBatch', 'name', 'scoring_type', 'scoring_config'] }
      ]
    });

    if (!participantResult) {
      return res.status(404).json({ status: false, message: 'Hasil ujian peserta tidak ditemukan atau belum selesai.' });
    }

    const { scoring_type, scoring_config } = participantResult.batch;
    
    // Fetch individual scores
    const participantScores = await getSectionScores(participantId, batchId, scoring_type, scoring_config);

    // 2. Calculate Batch Average (Cached to prevent DB overload)
    const cacheKey = `batch_avg_sections_${batchId}`;
    let batchAverages = await getCache(cacheKey);

    if (!batchAverages) {
      const allResults = await userresult.findAll({
        where: { batchId: batchId, status: 'COMPLETED' },
        attributes: ['userId']
      });

      const batchTotals = {};
      let validParticipantCount = 0;

      // Sequential to avoid pool exhaustion for large batches
      for (const row of allResults) {
        const scores = await getSectionScores(row.userId, batchId, scoring_type, scoring_config);
        if (scores) {
          validParticipantCount++;
          for (const [section, score] of Object.entries(scores)) {
            if (!batchTotals[section]) batchTotals[section] = 0;
            batchTotals[section] += score;
          }
        }
      }

      batchAverages = {};
      for (const [section, total] of Object.entries(batchTotals)) {
        batchAverages[section] = Math.round(total / validParticipantCount);
      }
      
      // Cache for 10 minutes
      await setCache(cacheKey, batchAverages, 600);
    }

    // 3. Construct Sections Data for Radar Chart
    const sections = [];
    for (const [section, score] of Object.entries(participantScores)) {
      sections.push({
        name: section,
        score: score,
        batchAverage: batchAverages[section] || 0,
      });
    }

    // 4. CEFR Mapping (Approximation based on standard TOEFL PBT/ITP)
    const totalScore = participantResult.score;
    let cefr = 'A1';
    let feedback = 'Perlu pondasi tata bahasa dan kosa kata yang lebih solid.';
    if (totalScore >= 627) { cefr = 'C1'; feedback = 'Sangat Berkembang. Anda mampu menggunakan bahasa Inggris kompleks dengan fasih.'; }
    else if (totalScore >= 543) { cefr = 'B2'; feedback = 'Berkembang. Anda mampu berkomunikasi secara komprehensif di level akademik/profesional.'; }
    else if (totalScore >= 460) { cefr = 'B1'; feedback = 'Cukup. Anda mengerti ide pokok dan konteks keseharian/pekerjaan.'; }
    else if (totalScore >= 337) { cefr = 'A2'; feedback = 'Pemula Lanjut. Mulai tingkatkan perbendaharaan kata dan struktur kalimat kompleks.'; }

    const reportData = {
      participant: participantResult.user,
      batch: participantResult.batch,
      testSummary: {
        totalScore: totalScore,
        testDate: participantResult.submittedAt,
        cefrLevel: cefr,
        feedback: feedback
      },
      sections: sections
    };

    return res.status(200).json({ status: true, data: reportData });
  } catch (error) {
    next(error);
  }
};
