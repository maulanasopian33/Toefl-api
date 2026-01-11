const db = require('../models');
const { Op } = require('sequelize');
const {
  calculateUserResult,
  getSectionScores
} = require('../services/resultService');
const { logger } = require('../utils/logger');

/**
 * Menghitung ulang hasil ujian untuk user di batch tertentu.
 */
exports.calculateResult = async (req, res) => {
  try {
    const { userId, batchId } = req.body;
    if (!userId || !batchId) {
      return res.status(400).json({ message: 'userId dan batchId wajib diisi' });
    }

    const result = await calculateUserResult(userId, batchId);
    res.json({ success: true, result });
  } catch (err) {
    logger.error(`calculateResult Error: ${err.message}`, { body: req.body });
    res.status(500).json({ success: false, message: 'Gagal menghitung hasil ujian' });
  }
};

/**
 * Mengambil hasil tes semua peserta untuk satu batch.
 * Route: GET /results/:batchId
 */
exports.getResultsByBatch = async (req, res, next) => {
  try {
    const { batchId } = req.params;

    // 1. Ambil semua hasil tes beserta data user dan batch
    const userResults = await db.userresult.findAll({
      where: { batchId },
      include: [
        {
          model: db.user, as: 'user',
          attributes: ['uid', 'name', 'email'],
          include: [{ model: db.detailuser, as: 'detailuser' }]
        },
        { model: db.batch, as: 'batch', attributes: ['name', 'scoring_type', 'scoring_config'] }
      ],
      order: [['score', 'DESC']]
    });

    if (!userResults || userResults.length === 0) {
      return res.status(404).json({ message: `Tidak ada hasil tes ditemukan untuk batch ID ${batchId}.` });
    }

    // 2. Format hasil (Logic perhitungan section pindah ke service)
    const formattedResults = await Promise.all(userResults.map(async (result) => {
      const sectionScores = await getSectionScores(
        result.userId,
        result.batchId,
        result.batch.scoring_type,
        result.batch.scoring_config
      );

      return {
        userId: result.user.uid,
        userName: result.user.name,
        userEmail: result.user.email,
        namaLengkap: result.user.detailuser?.namaLengkap || null,
        nim: result.user.detailuser?.nim || null,
        score: result.score,
        sectionScores,
        submittedAt: result.submittedAt
      };
    }));

    res.status(200).json(formattedResults);
  } catch (error) {
    logger.error(`getResultsByBatch Error: ${error.message}`, { batchId: req.params.batchId });
    next(error);
  }
};

/**
 * Mengambil detail satu hasil tes berdasarkan ID.
 * Route: GET /results/detail/:resultId
 */
exports.getResultById = async (req, res, next) => {
  try {
    const { resultId } = req.params;
    const numericId = resultId.startsWith('res-') ? resultId.substring(4) : resultId;

    if (isNaN(numericId)) {
      return res.status(400).json({ message: 'Format ID tidak valid.' });
    }

    const userResult = await db.userresult.findByPk(numericId, {
      include: [
        {
          model: db.user, as: 'user',
          attributes: ['uid', 'name', 'email'],
          include: [{ model: db.detailuser, as: 'detailuser' }]
        },
        { model: db.batch, as: 'batch', attributes: ['name', 'scoring_type', 'scoring_config'] }
      ]
    });

    if (!userResult) {
      return res.status(404).json({ message: 'Hasil tes tidak ditemukan.' });
    }

    const sectionScores = await getSectionScores(
      userResult.userId,
      userResult.batchId,
      userResult.batch.scoring_type,
      userResult.batch.scoring_config
    );

    res.status(200).json({
      id: `res-${userResult.id}`,
      user: {
        uid: userResult.user.uid,
        name: userResult.user.name,
        email: userResult.user.email,
        detail: userResult.user.detailuser
      },
      batchName: userResult.batch.name,
      score: userResult.score,
      sectionScores,
      submittedAt: userResult.submittedAt
    });
  } catch (error) {
    logger.error(`getResultById Error: ${error.message}`, { resultId: req.params.resultId });
    next(error);
  }
};

/**
 * Mengambil semua hasil tes untuk satu user dalam batch tertentu.
 * Route: GET /results/user/:userId/batch/:batchId
 */
exports.getResultsByUserAndBatch = async (req, res, next) => {
  try {
    const { userId: userUid, batchId } = req.params;

    const user = await db.user.findOne({
      where: { uid: userUid },
      include: [{ model: db.detailuser, as: 'detailuser' }]
    });

    if (!user) {
      return res.status(404).json({ message: `User ${userUid} tidak ditemukan.` });
    }

    const userResults = await db.userresult.findAll({
      where: { userId: user.uid, batchId: batchId },
      include: [{ model: db.batch, as: 'batch', attributes: ['name', 'scoring_type', 'scoring_config'] }],
      order: [['submittedAt', 'DESC']],
    });

    const resultsList = await Promise.all(userResults.map(async (result) => {
      const sectionScores = await getSectionScores(
        user.uid,
        batchId,
        result.batch.scoring_type,
        result.batch.scoring_config
      );

      return {
        id: `res-${result.id}`,
        batchName: result.batch.name,
        completedDate: result.submittedAt,
        score: result.score,
        sectionScores,
      };
    }));

    res.status(200).json({
      userId: user.uid,
      userName: user.name,
      userEmail: user.email,
      nim: user.detailuser?.nim || null,
      namaLengkap: user.detailuser?.namaLengkap || null,
      results: resultsList
    });
  } catch (error) {
    logger.error(`getResultsByUserAndBatch Error: ${error.message}`, { params: req.params });
    next(error);
  }
};

/**
 * Mengambil detail jawaban untuk sebuah percobaan (attempt).
 * Route: GET /results/answers/:attemptId
 */
exports.getAnswersByAttemptId = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const numericId = attemptId.startsWith('res-') ? attemptId.substring(4) : attemptId;

    const userAnswers = await db.useranswer.findAll({
      where: { userResultId: numericId },
      include: [
        {
          model: db.question, as: 'question',
          attributes: ['idQuestion', 'text'],
          include: [
            { model: db.option, as: 'options', attributes: ['idOption', 'text', 'isCorrect'] },
            {
              model: db.group, as: 'group',
              include: [{ model: db.section, as: 'section', attributes: ['namaSection'] }]
            },
          ],
        },
      ],
      order: [[{ model: db.question, as: 'question' }, 'idQuestion', 'ASC']],
    });

    const answerDetails = userAnswers.map((answer, index) => {
      const question = answer.question;
      const userAnswerOption = question.options.find(opt => opt.idOption === answer.optionId);
      const correctAnswer = question.options.find(opt => opt.isCorrect);

      return {
        number: index + 1,
        questionText: question.text,
        userAnswer: userAnswerOption?.text || null,
        correctAnswer: correctAnswer?.text || null,
        isCorrect: answer.optionId === correctAnswer?.idOption,
        section: question.group?.section?.namaSection || "-"
      };
    });

    res.status(200).json(answerDetails);
  } catch (error) {
    logger.error(`getAnswersByAttemptId Error: ${error.message}`, { attemptId: req.params.attemptId });
    next(error);
  }
};
