const { 
  userresult, 
  useranswer, 
  question, 
  option, 
  batch, 
  section, 
  group, 
  payment,
  user,
  batchparticipant,
  sequelize 
} = require('../models');
const { Op } = require('sequelize');
const { jsonToCsv } = require('../utils/csvGenerator');

exports.getExamReport = async (req, res, next) => {
  try {
    const { batchId } = req.query;
    const whereResult = {};
    if (batchId) whereResult.batchId = batchId;

    // 1. Overall Summary
    const summary = await userresult.findOne({
      where: whereResult,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalParticipants'],
        [sequelize.fn('AVG', sequelize.col('score')), 'avgScore'],
        [sequelize.fn('MAX', sequelize.col('score')), 'maxScore'],
        [sequelize.fn('MIN', sequelize.col('score')), 'minScore'],
      ],
      raw: true,
    });

    // 2. Score Distribution
    // Group scores into ranges: <400, 400-450, 451-500, 501-550, 551-600, >600
    const distribution = await userresult.findAll({
      where: whereResult,
      attributes: [
        [
          sequelize.literal(`
            CASE 
              WHEN score < 400 THEN '< 400'
              WHEN score BETWEEN 400 AND 450 THEN '400-450'
              WHEN score BETWEEN 451 AND 500 THEN '451-500'
              WHEN score BETWEEN 501 AND 550 THEN '501-550'
              WHEN score BETWEEN 551 AND 600 THEN '551-600'
              ELSE '> 600'
            END
          `), 
          'range'
        ],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['range'],
      raw: true
    });

    // 3. Section Performance
    // Calculate average correct percentage per section
    const sectionStats = await useranswer.findAll({
      where: batchId ? { batchId } : {},
      attributes: [
        [sequelize.col('question.group.section.namaSection'), 'sectionName'],
        [
          sequelize.fn('AVG', sequelize.literal("CASE WHEN option.isCorrect = 1 THEN 100 ELSE 0 END")), 
          'avgCorrectPercentage'
        ]
      ],
      include: [
        { model: option, as: 'option', attributes: [], required: true },
        { 
          model: question, as: 'question', attributes: [], required: true,
          include: [{ 
            model: group, as: 'group', attributes: [], required: true,
            include: [{ model: section, as: 'section', attributes: [], required: true }]
          }]
        }
      ],
      group: [sequelize.col('question.group.section.idSection'), sequelize.col('question.group.section.namaSection')],
      raw: true
    });

    // 4. Difficulty Analysis (Top 5 Difficult & Top 5 Easiest)
    const questionPerformance = await useranswer.findAll({
      where: batchId ? { batchId } : {},
      attributes: [
        [sequelize.col('question.idQuestion'), 'id'],
        [sequelize.col('question.text'), 'text'],
        [
          sequelize.fn('AVG', sequelize.literal("CASE WHEN option.isCorrect = 1 THEN 100 ELSE 0 END")), 
          'correctPercentage'
        ],
        [sequelize.fn('COUNT', sequelize.col('useranswer.id')), 'totalAttempts']
      ],
      include: [
        { model: option, as: 'option', attributes: [], required: true },
        { model: question, as: 'question', attributes: [], required: true }
      ],
      group: [sequelize.col('question.idQuestion'), sequelize.col('question.text')],
      having: sequelize.literal('totalAttempts > 0'),
      raw: true
    });

    const sortedPerformance = [...questionPerformance].sort((a, b) => a.correctPercentage - b.correctPercentage);
    const difficultQuestions = sortedPerformance.slice(0, 5);
    const easiestQuestions = sortedPerformance.slice(-5).reverse();

    res.status(200).json({
      status: true,
      data: {
        summary: {
          totalParticipants: summary.totalParticipants || 0,
          avgScore: Math.round(summary.avgScore || 0),
          maxScore: summary.maxScore || 0,
          minScore: summary.minScore || 0
        },
        distribution,
        sectionStats,
        difficulty: {
          hardest: difficultQuestions,
          easiest: easiestQuestions
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getParticipantReport = async (req, res, next) => {
  try {
    const { batchId, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (batchId) {
      whereClause.batchId = batchId;
    }

    // Search by user name or email
    const userWhereClause = {};
    if (search) {
      userWhereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await userresult.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: sequelize.models.user, 
          as: 'user', 
          attributes: ['id', 'name', 'email'],
          where: userWhereClause,
          required: true 
        },
        {
          model: batch,
          as: 'batch',
          attributes: ['idBatch', 'name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true // Important for correct count with includes
    });

    res.status(200).json({
      status: true,
      data: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        participants: rows
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.exportExamReportCSV = async (req, res, next) => {
  try {
    const { batchId } = req.query;
    const questionPerformance = await useranswer.findAll({
      where: batchId ? { batchId } : {},
      attributes: [
        [sequelize.col('question.idQuestion'), 'id'],
        [sequelize.col('question.text'), 'text'],
        [
          sequelize.fn('AVG', sequelize.literal("CASE WHEN option.isCorrect = 1 THEN 100 ELSE 0 END")), 
          'correctPercentage'
        ],
        [sequelize.fn('COUNT', sequelize.col('useranswer.id')), 'totalAttempts']
      ],
      include: [
        { model: option, as: 'option', attributes: [], required: true },
        { model: question, as: 'question', attributes: [], required: true }
      ],
      group: [sequelize.col('question.idQuestion'), sequelize.col('question.text')],
      raw: true
    });

    const csvData = questionPerformance.map(q => ({
      ID: q.id,
      Question: q.text.replace(/<\/?[^>]+(>|$)/g, ""),
      'Correct Percentage (%)': Math.round(q.correctPercentage),
      'Total Attempts': q.totalAttempts
    }));

    const csv = jsonToCsv(csvData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=exam-report-${batchId || 'all'}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

exports.exportParticipantReportCSV = async (req, res, next) => {
  try {
    const { batchId, search } = req.query;
    const whereClause = {};
    if (batchId) whereClause.batchId = batchId;

    const userWhereClause = {};
    if (search) {
      userWhereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const participants = await userresult.findAll({
      where: whereClause,
      include: [
        { 
          model: user, 
          as: 'user', 
          attributes: ['name', 'email'],
          where: userWhereClause,
          required: true 
        },
        {
          model: batch,
          as: 'batch',
          attributes: ['name']
        }
      ],
      order: [['score', 'DESC']],
      raw: true
    });

    const csvData = participants.map(p => ({
      Name: p['user.name'],
      Email: p['user.email'],
      Batch: p['batch.name'],
      Score: p.score,
      Date: p.createdAt
    }));

    const csv = jsonToCsv(csvData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=participant-report-${batchId || 'all'}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

exports.exportFinancialReportCSV = async (req, res, next) => {
  try {
    const { startDate, endDate, batchId } = req.query;
    const whereCondition = {};
    if (startDate && endDate) {
      whereCondition.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const participantWhere = {};
    if (batchId) participantWhere.batchId = batchId;

    const payments = await payment.findAll({
      where: whereCondition,
      include: [
        {
          model: batchparticipant,
          as: 'participant',
          where: participantWhere,
          required: true,
          include: [
            { model: user, as: 'user', attributes: ['name', 'email'] },
            { model: batch, as: 'batch', attributes: ['name'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      raw: true
    });

    const csvData = payments.map(p => ({
      Invoice: p.invoiceNumber,
      Name: p['participant.user.name'],
      Email: p['participant.user.email'],
      Batch: p['participant.batch.name'],
      Amount: p.amount,
      Status: p.status,
      Method: p.method,
      Date: p.createdAt
    }));

    const csv = jsonToCsv(csvData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=financial-report-${startDate || 'start'}-to-${endDate || 'end'}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
