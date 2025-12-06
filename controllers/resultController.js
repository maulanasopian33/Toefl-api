const db = require('../models');
const { Op } = require('sequelize');
const { calculateUserResult } = require('../services/resultService');


exports.calculateResult = async (req, res) => {
  try {
    const { userId, batchId } = req.body;
    if (!userId || !batchId) {
      return res.status(400).json({ message: 'userId dan batchId wajib diisi' });
    }

    const result = await calculateUserResult(userId, batchId);
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghitung hasil ujian' });
  }
};

/**
 * Tabel konversi skor TOEFL ITP.
 */
const convertScore = (correctCount, conversionType) => {
  const scoresForCount = {
    listening: [24, 25, 26, 27, 29, 30, 31, 32, 32, 33, 35, 37, 37, 38, 41, 41, 42, 43, 44, 45, 45, 46, 47, 48, 49, 49, 50, 51, 52, 53, 54, 54, 55, 56, 57, 57, 58, 59, 60, 61, 62, 63, 65, 66, 67, 67, 68],
    structure: [20, 20, 21, 22, 23, 25, 26, 27, 29, 31, 33, 35, 36, 37, 38, 40, 40, 41, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 60, 61, 63, 65, 67, 68],
    reading: [21, 22, 23, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 43, 44, 45, 46, 46, 47, 48, 49, 50, 51, 52, 52, 53, 54, 54, 55, 56, 57, 58, 59, 60, 61, 63, 65, 66, 67],
  };
  if (correctCount <= 0) return scoresForCount[conversionType]?.[0] || 20;
  if (correctCount >= scoresForCount[conversionType].length) return scoresForCount[conversionType]?.[scoresForCount[conversionType].length - 1] || 68;
  return scoresForCount[conversionType]?.[correctCount - 1] || 20;
};

/**
 * Menentukan tipe konversi skor berdasarkan nama section.
 */
const getConversionTypeFromName = (sectionName) => {
  const lowerCaseName = sectionName.toLowerCase();
  if (lowerCaseName.includes('listening') || lowerCaseName.includes('istima')) return 'listening';
  if (lowerCaseName.includes('structure') || lowerCaseName.includes('tarakib')) return 'structure';
  if (lowerCaseName.includes('reading') || lowerCaseName.includes('qira\'ah')) return 'reading';
  return 'structure'; // Fallback
};

/**
 * [BARU] Mengambil hasil tes semua peserta untuk satu batch.
 * Route: GET /results/:batchId
 */
exports.getResultsByBatch = async (req, res, next) => {
  try {
    const { batchId } = req.params;

    // 1. Ambil semua hasil tes untuk batch ini, termasuk data user dan batch
    const userResults = await db.userresult.findAll({
      where: { batchId },
      include: [
        {
          model: db.user,
          as: 'user',
          attributes: ['uid', 'name', 'email'],
          include: [{ model: db.detailuser, as: 'detailuser' }]
        },
        { model: db.batch, as: 'batch', attributes: ['namaBatch'] }
      ],
      order: [['score', 'DESC']]
    });

    if (!userResults || userResults.length === 0) {
      return res.status(404).json({ message: `Tidak ada hasil tes yang ditemukan untuk batch ID ${batchId}.` });
    }

    // 2. Ambil semua jawaban dari semua user di batch ini dalam satu query
    const userIds = userResults.map(r => r.userId);
    const allAnswers = await db.userAnswer.findAll({
      where: { batchId, userId: { [Op.in]: userIds } },
      attributes: ['userId', 'optionId'],
      include: [{
        model: db.question, as: 'question', attributes: ['idQuestion'],
        include: [
          { model: db.option, as: 'options', where: { isCorrect: true }, attributes: ['idOption'], required: false },
          { model: db.group, as: 'group', attributes: ['sectionId'], include: [{ model: db.section, as: 'section', attributes: ['idSection', 'namaSection'] }] }
        ]
      }]
    });

    // 3. Proses jawaban dan hitung skor per section untuk setiap user
    const sectionScoresByUser = {}; // { userId: { sectionName: score, ... } }
    allAnswers.forEach(answer => {
      const userId = answer.userId;
      const section = answer.question?.group?.section;
      if (!userId || !section) return;

      // Inisialisasi jika user belum ada di map
      if (!sectionScoresByUser[userId]) sectionScoresByUser[userId] = {};
      // Inisialisasi jika section belum ada untuk user ini
      if (!sectionScoresByUser[userId][section.namaSection]) {
        sectionScoresByUser[userId][section.namaSection] = { correct: 0, conversionType: getConversionTypeFromName(section.namaSection) };
      }

      const isCorrect = answer.question?.options[0]?.idOption === answer.optionId;
      if (isCorrect) {
        sectionScoresByUser[userId][section.namaSection].correct++;
      }
    });

    // 4. Format hasil akhir sesuai permintaan
    const resultsByUser = new Map();
    userResults.forEach(result => {
      const userId = result.user.uid;

      // Jika user belum ada di Map, inisialisasi data user
      if (!resultsByUser.has(userId)) {
        resultsByUser.set(userId, {
          userId: userId,
          userName: result.user.name,
          userEmail: result.user.email,
          namaLengkap: result.user.detailuser?.namaLengkap || null,
          nim: result.user.detailuser?.nim || null,
          prodi: result.user.detailuser?.prodi || null,
          fakultas: result.user.detailuser?.fakultas || null,
          results: []
        });
      }

      // Hitung skor section untuk hasil tes ini
      const userSectionScores = sectionScoresByUser[result.userId] || {};
      const finalSectionScores = {};
      for (const [name, data] of Object.entries(userSectionScores)) {
        finalSectionScores[name] = convertScore(data.correct, data.conversionType);
      }

      // Tambahkan detail hasil tes ke dalam array 'results' milik user
      resultsByUser.get(userId).results.push({
        id: `res-${result.id}`,
        batchName: result.batch.namaBatch,
        completedDate: result.submittedAt,
        score: result.score,
        sectionScores: finalSectionScores,
      });
    });

    res.status(200).json(Array.from(resultsByUser.values()));
  } catch (error) {
    next(error);
  }
};

/**
 * [BARU] Mengambil detail satu hasil tes berdasarkan ID-nya.
 * Route: GET /results/detail/:resultId
 */
exports.getResultById = async (req, res, next) => {
  try {
    const { resultId } = req.params;
    // Validasi dan ekstrak ID numerik dari format 'res-123'
    const numericId = resultId.startsWith('res-') ? resultId.substring(4) : resultId;

    if (isNaN(numericId)) {
      return res.status(400).json({ message: 'Format ID hasil tes tidak valid.' });
    }

    // 1. Ambil data hasil tes utama beserta relasi
    const userResult = await db.userresult.findByPk(numericId, {
      include: [
        {
          model: db.user,
          as: 'user',
          attributes: ['uid', 'name', 'email'],
          include: [{ model: db.detailuser, as: 'detailuser' }]
        },
        { model: db.batch, as: 'batch', attributes: ['namaBatch'] }
      ]
    });

    if (!userResult) {
      return res.status(404).json({ message: `Hasil tes dengan ID ${resultId} tidak ditemukan.` });
    }

    // 2. Ambil jawaban user untuk menghitung skor per section
    const userAnswers = await db.userAnswer.findAll({
      where: { userId: userResult.userId, batchId: userResult.batchId },
      include: [{
        model: db.question, as: 'question', attributes: ['idQuestion'],
        include: [
          { model: db.option, as: 'options', where: { isCorrect: true }, attributes: ['idOption'], required: false },
          { model: db.group, as: 'group', include: [{ model: db.section, as: 'section', attributes: ['namaSection'] }] }
        ]
      }]
    });

    // 3. Hitung skor per section
    const sectionCorrectCounts = {};
    userAnswers.forEach(answer => {
      const section = answer.question?.group?.section;
      if (!section) return;

      const conversionType = getConversionTypeFromName(section.namaSection);
      if (!sectionCorrectCounts[conversionType]) {
        sectionCorrectCounts[conversionType] = { correct: 0, name: section.namaSection };
      }

      if (answer.question?.options[0]?.idOption === answer.optionId) {
        sectionCorrectCounts[conversionType].correct++;
      }
    });

    const finalSectionScores = {};
    for (const [type, data] of Object.entries(sectionCorrectCounts)) {
      finalSectionScores[data.name] = convertScore(data.correct, type);
    }

    // 4. Format hasil akhir
    const result = {
      id: `res-${userResult.id}`,
      userId: userResult.user.uid,
      userName: userResult.user.name,
      userEmail: userResult.user.email,
      namaLengkap: userResult.user.detailuser?.namaLengkap || null,
      nim: userResult.user.detailuser?.nim || null,
      prodi: userResult.user.detailuser?.prodi || null,
      fakultas: userResult.user.detailuser?.fakultas || null,
      batchName: userResult.batch.namaBatch,
      completedDate: userResult.submittedAt,
      score: userResult.score,
      sectionScores: finalSectionScores,
    };

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * [BARU] Mengambil semua hasil tes untuk satu user dalam satu batch.
 * Route: GET /results/user/:userId/batch/:batchId
 */
exports.getResultsByUserAndBatch = async (req, res, next) => {
  try {
    const { userId: userUid, batchId } = req.params;

    // 1. Cari user berdasarkan UID untuk mendapatkan ID internal
    const user = await db.user.findOne({
      where: { uid: userUid },
      include: [{ model: db.detailuser, as: 'detailuser' }]
    });

    if (!user) {
      return res.status(404).json({ message: `User dengan ID ${userUid} tidak ditemukan.` });
    }

    // 2. Ambil semua hasil tes untuk user dan batch tersebut
    const userResults = await db.userresult.findAll({
      where: {
        // PERBAIKAN: Gunakan user.uid (Primary Key) bukan user.uid
        userId: user.uid,
        batchId: batchId,
      },
      include: [{ model: db.batch, as: 'batch', attributes: ['namaBatch'] }],
      order: [['submittedAt', 'DESC']],
    });

    // 3. Iterasi setiap hasil tes untuk menghitung skor section-nya secara individual
    const resultsList = await Promise.all(userResults.map(async (result) => {
      // Ambil jawaban yang terkait dengan userResult ini (berdasarkan waktu submit)
      const userAnswers = await db.userAnswer.findAll({
        where: {
          userId: user.uid,
          batchId: result.batchId,
          // Asumsi: jawaban disimpan pada waktu yang sama dengan hasil
          createdAt: { [Op.lte]: result.submittedAt }
        },
        include: [{
          model: db.question, as: 'question',
          include: [
            { model: db.option, as: 'options', where: { isCorrect: true }, required: false },
            { model: db.group, as: 'group', include: [{ model: db.section, as: 'section' }] }
          ]
        }]
      });

      // Hitung skor per section untuk hasil tes ini
      const sectionCorrectCounts = {};
      userAnswers.forEach(answer => {
        const section = answer.question?.group?.section;
        if (!section) return;

        // PERBAIKAN: Gunakan nama section sebagai kunci unik, bukan tipe konversi
        if (!sectionCorrectCounts[section.namaSection]) {
          sectionCorrectCounts[section.namaSection] = { 
            correct: 0, 
            conversionType: getConversionTypeFromName(section.namaSection) 
          };
        }
        if (answer.question?.options[0]?.idOption === answer.optionId) {
          sectionCorrectCounts[section.namaSection].correct++;
        }
      });

      const finalSectionScores = {};
      for (const [sectionName, data] of Object.entries(sectionCorrectCounts)) {
        finalSectionScores[sectionName] = convertScore(data.correct, data.conversionType);
      }

      return {
        id: `res-${result.id}`,
        batchName: result.batch.namaBatch,
        completedDate: result.submittedAt,
        score: result.score,
        sectionScores: finalSectionScores,
      };
    }));
    
    const finalResponse = {
      // Menggunakan ID dari hasil tes pertama sebagai ID utama jika ada, jika tidak null
      id: resultsList.length > 0 ? resultsList[0].id : null,
      userId: user.uid,
      userName: user.name,
      userEmail: user.email,
      nim: user.detailuser?.nim || null,
      // Mengambil nama batch dari hasil pertama jika ada
      batchName: resultsList.length > 0 ? resultsList[0].batchName : null,
      // Mengambil tanggal dari hasil pertama jika ada
      completedDate: resultsList.length > 0 ? resultsList[0].completedDate : null,
      score: resultsList.length > 0 ? resultsList[0].score : null, // Contoh: skor dari tes terbaru
      results: resultsList,
    };

    res.status(200).json(finalResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * [BARU] Mengambil detail jawaban untuk sebuah percobaan tes (attempt).
 * Route: GET /results/answers/:attemptId
 */
exports.getAnswersByAttemptId = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const numericId = attemptId.startsWith('res-') ? attemptId.substring(4) : attemptId;

    if (isNaN(numericId)) {
      return res.status(400).json({ message: 'Format ID percobaan tes tidak valid.' });
    }

    // 1. Ambil semua jawaban untuk attemptId yang spesifik
    const userAnswers = await db.userAnswer.findAll({
      where: { userResultId: numericId },
      include: [
        {
          model: db.question,
          as: 'question',
          attributes: ['idQuestion', 'text'],
          include: [
            {
              model: db.option,
              as: 'options', // Ambil semua opsi untuk mencari jawaban benar dan jawaban user
              attributes: ['idOption', 'text', 'isCorrect'],
            },
            {
              model: db.group,
              as: 'group',
              attributes: [],
              include: [{ model: db.section, as: 'section', attributes: ['namaSection'] }],
            },
          ],
        },
      ],
      order: [[{ model: db.question, as: 'question' }, 'idQuestion', 'ASC']],
    });

    if (userAnswers.length === 0) {
      return res.status(404).json({ message: `Tidak ada jawaban ditemukan untuk percobaan tes ID ${attemptId}.` });
    }

    // 2. Format data sesuai dengan struktur yang diinginkan
    const answerDetails = userAnswers.map((answer, index) => {
      const question = answer.question;
      const allOptions = question.options;

      const userAnswerOption = allOptions.find(opt => opt.idOption === answer.optionId);
      const correctAnswerOption = allOptions.find(opt => opt.isCorrect);

      return {
        questionNumber: index + 1,
        questionText: question.text,
        userAnswer: userAnswerOption ? userAnswerOption.text : null,
        correctAnswer: correctAnswerOption ? correctAnswerOption.text : null,
        isCorrect: answer.optionId === correctAnswerOption?.idOption,
        section: question.text || "-",
      };
    });

    res.status(200).json(answerDetails);
  } catch (error) {
    next(error);
  }
};
