// controllers/examController.js

const { Op } = require('sequelize');
const db = require('../models');
const { sequelize } = require('../models');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

/**
 * Mengambil seluruh data ujian (sections, groups, questions, options)
 * berdasarkan ID batch.
 */
exports.getExamData = async (req, res, next) => {
  try {
    const { examId } = req.params;

    // 1. Cek status lock (apakah sudah mulai atau sudah ada pengerjaan)
    const batch = await db.batch.findByPk(examId, { attributes: ['start_date', 'status'] });
    const submissionCount = await db.userresult.count({ where: { batchId: examId } });
    
    // Lock jika: sudah ada pengerjaan OR sudah masuk waktu mulai
    const isLocked = submissionCount > 0 || (batch?.start_date && new Date(batch.start_date) <= new Date());

    const sections = await db.section.findAll({
      where: { batchId: { [Op.eq]: examId } },
      include: [
        {
          model: db.group,
          as: 'groups',
          include: [
            {
              model: db.question,
              as: 'questions',
              include: [
                {
                  model: db.option,
                  as: 'options',
                  attributes: ['idOption', 'text', 'isCorrect'],
                },
              ], // Include type from question model
              attributes: ['idQuestion', 'text', 'type', 'audioUrl'],
            },
            {
              model: db.groupaudioinstruction,
              as: 'audioInstructions',
              attributes: ['audioUrl'],
            },
          ], // Include idGroup for keying in FE
          attributes: ['idGroup', 'passage'],
        },
        {
          model: db.sectionaudioinstruction,
          as: 'audioInstructions',
          attributes: ['audioUrl'],
        },
      ],
      attributes: ['idSection', 'namaSection', 'deskripsi', 'urutan'],
      order: [
        ['urutan', 'ASC'],
        [{ model: db.group, as: 'groups' }, 'idGroup', 'ASC'],
        [{ model: db.group, as: 'groups' }, { model: db.question, as: 'questions' }, 'idQuestion', 'ASC'],
        [{ model: db.group, as: 'groups' }, { model: db.question, as: 'questions' }, { model: db.option, as: 'options' }, 'idOption', 'ASC'],
      ],
    });

    if (!sections || sections.length === 0) {
      return res.status(404).json({ message: `Ujian dengan ID ${examId} tidak ditemukan.` });
    }

   logger.info('Sections:', sections);
    // Format data sesuai ekspektasi frontend
    const formattedData = sections.map(section => {
      return {
        id: section.idSection,
        name: section.namaSection,
        type: section.namaSection, // Use namaSection for type as well
        instructions: section.deskripsi, // Frontend will receive HTML escaped
        audioUrl: section.audioInstructions && section.audioInstructions.length > 0 ? section.audioInstructions[0].audioUrl : null,
        groups: section.groups.map(group => {
          return {
            // 'id' for group is not in the example, but idGroup is useful for FE keys
            id: group.idGroup,
            passage: group.passage, // Frontend will receive HTML escaped
            // Get audioUrl from the first audioInstruction if it exists
            audioUrl: group.audioInstructions.length > 0 ? group.audioInstructions[0].audioUrl : null,
            questions: group.questions.map(question => {
              // Find the correct option to get 'correctAnswer'
              const correctOption = question.options.find(opt => opt.isCorrect);
              return {
                id: question.idQuestion,
                type: question.type || section.namaSection, // Use question type, fallback to section name
                question: question.text, // Frontend will receive HTML escaped
                audioUrl: question.audioUrl,
                options: question.options.map(opt => opt.text),
                correctAnswer: correctOption ? correctOption.text : null,
                userAnswer: null, // Add userAnswer as requested by FE structure
              };
            }),
          };
        }),
      };
    });

    // Send response with locking metadata
    res.status(200).json({
      status: true,
      isLocked: !!isLocked,
      lockReason: submissionCount > 0 ? 'SUBMISSIONS_EXIST' : (batch?.start_date && new Date(batch.start_date) <= new Date() ? 'BATCH_STARTED' : null),
      data: formattedData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Menyimpan atau memperbarui seluruh struktur data ujian.
 * Endpoint ini akan dipanggil oleh tombol "Simpan" utama di editor.
 */
exports.updateExamData = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { examId: batchId } = req.params;
    const sectionsData = req.body;

    // --- 0. Cek Locking ---
    const batch = await db.batch.findByPk(batchId, { attributes: ['start_date'] });
    const submissionCount = await db.userresult.count({ where: { batchId } });
    const isLocked = submissionCount > 0 || (batch?.start_date && new Date(batch.start_date) <= new Date());

    if (isLocked) {
      return res.status(403).json({ 
        status: false, 
        message: "Ujian terkunci karena sudah ada pengerjaan atau waktu ujian telah dimulai." 
      });
    }

    if (!Array.isArray(sectionsData)) {
      return res.status(400).json({ message: "Struktur data yang dikirim tidak valid. Body harus berupa array." });
    }

    // --- 1. Kumpulkan semua ID dan data dari payload ---
    const incomingSectionIds = [];
    const incomingGroupIds = [];
    const incomingQuestionIds = [];

    const sectionsToUpsert = [];
    const groupsToUpsert = [];
    const questionsToUpsert = [];
    const optionsToUpsert = [];
    const audioInstructionsToUpsert = [];
    const sectionAudioInstructionsToUpsert = [];

    let sectionIndex = 0;
    for (const section of sectionsData) {
      sectionIndex++;
      incomingSectionIds.push(section.id);
      sectionsToUpsert.push({
        idSection: section.id,
        namaSection: section.name,
        deskripsi: section.instructions,
        urutan: sectionIndex, // Set urutan based on counter
        batchId,
      });

      if (section.audioUrl) {
        sectionAudioInstructionsToUpsert.push({
          sectionId: section.id,
          audioUrl: section.audioUrl,
          description: `Audio for section ${section.id}`,
        });
      }

      for (const group of section.groups) {
        incomingGroupIds.push(group.id);
        groupsToUpsert.push({
          idGroup: group.id,
          passage: group.passage,
          sectionId: section.id,
          batchId, // Denormalisasi untuk mempermudah penghapusan
        });

        if (group.audioUrl) {
          audioInstructionsToUpsert.push({
            groupId: group.id,
            audioUrl: group.audioUrl,
            description: `Audio for group ${group.id}`,
          });
        }

        for (const question of group.questions) {
          incomingQuestionIds.push(question.id);
          questionsToUpsert.push({
            idQuestion: question.id,
            text: question.question,
            type: question.type,
            groupId: group.id,
            audioUrl: question.audioUrl,
          });

          question.options.forEach((optionText, index) => {
            // Buat ID unik dan deterministik untuk opsi
            // Gunakan MD5 hash dari teks untuk memastikan ID stabil tapi tetap unik
            const hash = crypto.createHash('md5').update(optionText.trim()).digest('hex').substring(0, 8);
            const idOption = `opt-${question.id}-${index}-${hash}`;
            
            optionsToUpsert.push({
              idOption,
              text: optionText,
              isCorrect: optionText.trim() === question.correctAnswer?.trim(),
              questionId: question.id,
            });
          });
        }
      }
    }

    // --- 2. Hapus data lama yang tidak ada di payload (Delete phase) ---
    // Urutan: dari anak ke induk untuk menghindari FK constraint errors.

    // Hapus Opsi untuk pertanyaan yang ada di payload (akan dibuat ulang)
    if (incomingQuestionIds.length > 0) {
      await db.option.destroy({ where: { questionId: { [Op.in]: incomingQuestionIds } }, transaction });
    }

    // Hapus Questions yang tidak ada di payload, tapi pastikan hanya dari batch ini
    const questionsToDelete = await db.question.findAll({
      attributes: ['idQuestion'],
      where: { idQuestion: { [Op.notIn]: incomingQuestionIds } },
      include: [{
        model: db.group, as: 'group', attributes: [], required: true,
        where: { batchId } // Menggunakan batchId yang sudah didenormalisasi di tabel group
      }],
      transaction
    });
    const questionIdsToDelete = questionsToDelete.map(q => q.idQuestion);
    if (questionIdsToDelete.length > 0) {
      // Hapus dulu opsi dari pertanyaan yang akan dihapus
      await db.option.destroy({ where: { questionId: { [Op.in]: questionIdsToDelete } }, transaction });
      await db.question.destroy({ where: { idQuestion: { [Op.in]: questionIdsToDelete } }, transaction });
    }

    // Hapus GroupAudioInstructions untuk grup yang ada di payload (akan dibuat ulang)
    if (incomingGroupIds.length > 0) {
      await db.groupaudioinstruction.destroy({ where: { groupId: { [Op.in]: incomingGroupIds } }, transaction });
    }

    // Hapus SectionAudioInstructions untuk section yang ada di payload (akan dibuat ulang)
    if (incomingSectionIds.length > 0) {
      await db.sectionaudioinstruction.destroy({ where: { sectionId: { [Op.in]: incomingSectionIds } }, transaction });
    }

    // Hapus Groups yang tidak ada di payload untuk batch ini
    await db.group.destroy({ where: { batchId: batchId, idGroup: { [Op.notIn]: incomingGroupIds } }, transaction });

    // Hapus Sections yang tidak ada di payload untuk batch ini
    await db.section.destroy({ where: { batchId: batchId, idSection: { [Op.notIn]: incomingSectionIds } }, transaction });

    // --- 3. Upsert (Update or Insert) data baru (Upsert phase) ---
    // Urutan: dari induk ke anak.

    await db.section.bulkCreate(sectionsToUpsert, { updateOnDuplicate: ["namaSection", "deskripsi", "urutan"], transaction });
    await db.group.bulkCreate(groupsToUpsert, { updateOnDuplicate: ["passage", "sectionId"], transaction });

    if (audioInstructionsToUpsert.length > 0) {
      await db.groupaudioinstruction.bulkCreate(audioInstructionsToUpsert, { transaction });
    }

    if (sectionAudioInstructionsToUpsert.length > 0) {
      await db.sectionaudioinstruction.bulkCreate(sectionAudioInstructionsToUpsert, { transaction });
    }

    await db.question.bulkCreate(questionsToUpsert, { updateOnDuplicate: ["text", "type", "audioUrl"], transaction });

    if (optionsToUpsert.length > 0) {
      await db.option.bulkCreate(optionsToUpsert, { transaction });
    }

    await transaction.commit();
    logger.info({
      message: `Exam data updated for batch ID: ${batchId}`,
      action: 'UPDATE_EXAM_DATA',
      user: req.user.email,
      details: { batchId }
    });
    res.status(200).json({ message: `Data ujian untuk batch ${batchId} berhasil diperbarui.` });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * [BARU] Mengambil metadata dasar sebuah tes (batch) dan urutan bagiannya.
 * Digunakan untuk memuat halaman awal ujian dengan cepat.
 * Route: GET /tests/:testId/metadata
 */
exports.getTestMetadata = async (req, res, next) => {
    const { testId } = req.params; // testId adalah batchId

    try {
        const batch = await db.batch.findByPk(testId, {
            attributes: ['idBatch', 'name', 'duration_minutes'],
            include: [{
                model: db.section,
                as: 'sections',
                attributes: ['idSection', 'namaSection'],
                include: [{
                    model: db.group,
                    as: 'groups',
                    attributes: ['idGroup'],
                    include: [{
                        model: db.question,
                        as: 'questions',
                        attributes: ['idQuestion']
                    }]
                }]
            }]
        });

        if (!batch) {
            return res.status(404).json({ message: `Ujian dengan ID ${testId} tidak ditemukan.` });
        }

        // Hitung total pertanyaan dari semua section dan group
        let totalQuestions = 0;
        batch.sections.forEach(section => {
            section.groups.forEach(group => {
                totalQuestions += group.questions.length;
            });
        });

        // Urutkan section berdasarkan field urutan
        const sectionOrder = batch.sections
            .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
            .map(s => ({ id: s.idSection, name: s.namaSection }));

        res.json({
            id: batch.idBatch,
            name: batch.name,
            start_date : batch.start_date,
            end_date :  batch.end_date,
            totalTime: batch.duration_minutes,
            totalQuestions: totalQuestions,
            sectionOrder: sectionOrder
        });

    } catch (error) {
        next(error);
    }
};

/**
 * [BARU] Mengambil seluruh data untuk satu bagian (section) spesifik.
 * Termasuk grup soal, pertanyaan, dan pilihan jawaban (tanpa kunci jawaban).
 * Route: GET /tests/:testId/sections/:sectionId
 */
exports.getSectionData = async (req, res, next) => {
  try {
    const { sectionId } = req.params;

    const section = await db.section.findByPk(sectionId, {
      attributes: ['idSection', 'namaSection', 'deskripsi'],
      include: [{
        model: db.sectionaudioinstruction,
        as: 'audioInstructions',
        attributes: ['audioUrl'],
      },
      {
        model: db.group,
        as: 'groups',
        attributes: ['idGroup', 'passage'],
        include: [{
            model: db.groupaudioinstruction,
            as: 'audioInstructions',
            attributes: ['audioUrl'],
          },
          {
            model: db.question,
            as: 'questions',
            attributes: ['idQuestion', 'text', 'audioUrl'], // 'text' adalah 'question'
            include: [{
              model: db.option,
              as: 'options',
              attributes: ['idOption', 'text'], // Tidak menyertakan isCorrect
            }, ],
          },
        ],
      }, ],
      order: [
        [{ model: db.group, as: 'groups' }, 'idGroup', 'ASC'],
        [{ model: db.group, as: 'groups' }, { model: db.question, as: 'questions' }, 'idQuestion', 'ASC'],
      ],
    });

    if (!section) {
      return res.status(404).json({ message: `Bagian dengan ID ${sectionId} tidak ditemukan.` });
    }

    // Format output JSON sesuai permintaan
    const formattedData = {
      id: section.idSection,
      name: section.namaSection,
      instructions: section.deskripsi,
      // Cari audio instruction di level section (jika ada)
      // Asumsi: audio instruction untuk section disimpan di group pertama tanpa passage
      audioInstructions: section.audioInstructions?.[0]?.audioUrl || null,
      groups: section.groups.map(group => ({
        id: group.idGroup,
        passage: group.passage,
        audioUrl: group.audioInstructions.length > 0 ? group.audioInstructions[0].audioUrl : null,
        questions: group.questions.map(question => ({
          id: question.idQuestion,
          question: question.text,
          audioUrl: question.audioUrl,
          options: question.options.map(opt => ({
            id: opt.idOption,
            text: opt.text,
          })),
        })),
      })),
    };

    res.status(200).json(formattedData);
  } catch (error) {
    next(error);
  }
};

/**
 * [BARU] Menerima jawaban dari pengguna, menghitung skor, dan menyimpan hasil.
 * Route: POST /tests/:testId/submit
 */
exports.submitTest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { testId } = req.params;
    const { answers } = req.body;
    const { uid } = req.user; // Ambil UID dari token Firebase

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "Body request tidak valid. 'answers' harus berupa array." });
    }

    // 1. Cari user di database lokal berdasarkan UID untuk mendapatkan ID primary key-nya.
    const user = await db.user.findOne({ where: { uid }, attributes: ['uid'], transaction });
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan di database." });
    }
    const localUserId = user.uid; // Ini adalah ID integer dari tabel 'users'

    // 2. Ambil semua ID pertanyaan dari jawaban pengguna
    const questionIds = answers.map(a => a.questionId);

    // 3. Ambil data pertanyaan dan kunci jawaban yang relevan dalam satu query
    const questionsWithAnswers = await db.question.findAll({
      where: {
        idQuestion: { [Op.in]: questionIds }
      },
      attributes: ['idQuestion'],
      include: [
        {
          model: db.option,
          as: 'options',
          where: { isCorrect: true },
          attributes: ['idOption'],
          required: false // Gunakan left join jika ada pertanyaan tanpa kunci jawaban
        },
        {
          model: db.group,
          as: 'group',
          attributes: ['sectionId'] // Ambil sectionId dari group terkait
        }
      ],
      transaction,
    });

    // 4. Buat map untuk pencarian cepat: { questionId: { correctOptionId, sectionId } }
    const answerKey = new Map(questionsWithAnswers.map(q => [
      q.idQuestion,
      {
        correctOptionId: q.options[0]?.idOption, // Ambil idOption dari opsi yang benar
        sectionId: q.group?.sectionId // Ambil sectionId dari relasi group
      }
    ]));

    // 5. Hitung skor dan siapkan data jawaban untuk disimpan
    let correctCount = 0;
    const userAnswersToSave = answers.map(answer => {
      const questionInfo = answerKey.get(answer.questionId);
      if (questionInfo && questionInfo.correctOptionId === answer.userAnswer) {
        correctCount++;
      }
      return {
        userId: localUserId, // Gunakan ID lokal (integer)
        batchId: testId,
        sectionId: questionInfo ? questionInfo.sectionId : null, // Tambahkan sectionId
        questionId: answer.questionId,
        optionId: answer.userAnswer,
      };
    });
    
    const totalQuestions = answers.length;
    const wrongCount = totalQuestions - correctCount;

    // Placeholder untuk logika skor TOEFL yang lebih kompleks jika diperlukan
    const finalScore = correctCount; // Saat ini skor = jumlah benar

    // 7. Simpan hasil akhir ke tabel userResult
    const createdResult = await db.userresult.create({
      userId: localUserId, // Gunakan ID lokal (integer)
      batchId: testId,
      totalQuestions: totalQuestions,
      correctCount: correctCount,
      wrongCount: wrongCount,
      score: finalScore,
      submittedAt: new Date(),
    }, { transaction });

    // 8. Tambahkan userResultId ke setiap jawaban dan simpan
    const answersWithResultId = userAnswersToSave.map(answer => ({
      ...answer,
      userResultId: createdResult.id,
    }));
    await db.useranswer.bulkCreate(answersWithResultId, { transaction });

    await transaction.commit();

    res.status(201).json({
      score: finalScore,
      totalQuestions: totalQuestions,
      correctCount: correctCount,
      wrongCount: wrongCount,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Tabel konversi skor TOEFL ITP.
 * @param {number} correctCount - Jumlah jawaban benar.
 * @param {string} conversionType - Tipe section ('listening', 'structure', 'reading').
 * @returns {number} Skor yang telah dikonversi.
 */
const convertScore = (correctCount, conversionType) => {
  const scoresForCount = {
    listening: [24, 25, 26, 27, 29, 30, 31, 32, 32, 33, 35, 37, 37, 38, 41, 41, 42, 43, 44, 45, 45, 46, 47, 48, 49, 49, 50, 51, 52, 53, 54, 54, 55, 56, 57, 57, 58, 59, 60, 61, 62, 63, 65, 66, 67, 67, 68],
    structure: [20, 20, 21, 22, 23, 25, 26, 27, 29, 31, 33, 35, 36, 37, 38, 40, 40, 41, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 60, 61, 63, 65, 67, 68],
    reading: [21, 22, 23, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 43, 44, 45, 46, 46, 47, 48, 49, 50, 51, 52, 52, 53, 54, 54, 55, 56, 57, 58, 59, 60, 61, 63, 65, 66, 67],
  };
  // Jika jumlah benar di luar rentang, kembalikan skor min/max
  if (correctCount <= 0) return scoresForCount[conversionType][0] || 20;
  if (correctCount >= scoresForCount[conversionType].length) return scoresForCount[conversionType][scoresForCount[conversionType].length - 1] || 68;

  return scoresForCount[conversionType][correctCount - 1] || 20;
};

/**
 * Menentukan tipe konversi skor berdasarkan nama section.
 * @param {string} sectionName - Nama section, contoh: "Listening Comprehension".
 * @returns {string} Tipe konversi ('listening', 'structure', 'reading').
 */
const getConversionTypeFromName = (sectionName) => {
  const lowerCaseName = sectionName.toLowerCase();
  if (lowerCaseName.includes('listening')) return 'listening';
  if (lowerCaseName.includes('structure')) return 'structure';
  if (lowerCaseName.includes('reading')) return 'reading';
  // Fallback default jika tidak ada yang cocok
  return 'structure';
};

/**
 * [BARU] Mengambil riwayat hasil tes untuk seorang peserta.
 * Route: GET /history/:historyId
 */
exports.getTestResult = async (req, res, next) => {
  try {
    const { historyId: rawHistoryId } = req.params;
    const { uid } = req.user; // Ambil UID dari token Firebase

    // Ekstrak ID numerik dari string format 'tes_history_123'
    const historyId = rawHistoryId.split('_').pop();

    // 1. Ambil hasil tes utama
    const userResult = await db.userresult.findOne({
      where: { id: historyId, userId: uid },
      include: [{ model: db.batch, as: 'batch', attributes: ['name'] }],
    });

    if (!userResult) {
      return res.status(404).json({ message: 'Riwayat tes tidak ditemukan.' });
    }

    // 2. Ambil semua jawaban pengguna untuk tes ini
    const userAnswers = await db.useranswer.findAll({
      where: { userId: uid, batchId: userResult.batchId },
      attributes: ['optionId'],
      include: [
        {
          model: db.question, as: 'question', attributes: ['idQuestion', 'text'],
          include: [
            { model: db.option, as: 'options', where: { isCorrect: true }, attributes: ['idOption'], required: false },
            { model: db.group, as: 'group', attributes: ['sectionId'], include: [{ model: db.section, as: 'section', attributes: ['idSection', 'namaSection'] }] }
          ]
        }
      ]
    });

    // 3. Hitung skor per section
    const sectionScores = {};
    userAnswers.forEach(answer => {
      const section = answer.question?.group?.section;
      if (!section) return;

      if (!sectionScores[section.idSection]) {
        const conversionType = getConversionTypeFromName(section.namaSection);
        sectionScores[section.idSection] = { name: section.namaSection, conversionType: conversionType, correct: 0, total: 0 };
      }

      const isCorrect = answer.question?.options[0]?.idOption === answer.optionId;
      if (isCorrect) {
        sectionScores[section.idSection].correct++;
      }
      sectionScores[section.idSection].total++;
    });

    // 4. Konversi ke skor skala dan format output
    let totalScaledScore = 0;
    const sectionsForResponse = Object.entries(sectionScores).map(([id, secData]) => {
      const rawScore = secData.correct;
      // Konversi skor mentah ke skor skala
      const scaledScore = convertScore(rawScore, secData.conversionType);
      totalScaledScore += scaledScore;
      return {
        name: secData.name,
        score: scaledScore,
      };
    });

    // 5. Hitung skor akhir TOEFL
    // Rata-rata dari 3 section, dikalikan 10
    const finalScore = Math.round((totalScaledScore / 3) * 10);

    // 6. Format jawaban pengguna untuk ditampilkan di frontend
    const detailedAnswers = userAnswers.map(answer => {
      const question = answer.question;
      const section = question?.group?.section;
      const isCorrect = question?.options[0]?.idOption === answer.optionId;

      return {
        questionId: question.idQuestion,
        questionText: question.text,
        userAnswerId: answer.optionId,
        correctAnswerId: question?.options[0]?.idOption,
        isCorrect: isCorrect,
        sectionName: section ? section.namaSection : 'Unknown',
      };
    });

    // 7. Kirim respons lengkap
    res.status(200).json({
      testName: userResult.batch.name,
      submittedAt: userResult.submittedAt,
      finalScore: finalScore,
      summary: {
        totalQuestions: userResult.totalQuestions,
        correctCount: userResult.correctCount,
        wrongCount: userResult.wrongCount,
      },
      sectionScores: sectionsForResponse,
      detailedAnswers: detailedAnswers,
    });

  } catch (error) {
    next(error);
  }
};

/**
 * [BARU] Mengambil daftar riwayat tes yang pernah dikerjakan oleh pengguna.
 * Route: GET /history
 */
exports.getTestHistoryList = async (req, res, next) => {
  try {
    const { uid } = req.user; // Ambil UID dari token Firebase

    const historyList = await db.userresult.findAll({
      where: { userId: uid },
      include: [{
        model: db.batch,
        as: 'batch',
        attributes: ['name'],
      }, ],
      attributes: ['id', 'score', 'submittedAt'], // 'id' di sini adalah historyId
      order: [
        ['submittedAt', 'DESC']
      ],
    });

    // Format respons agar lebih ramah untuk frontend
    const formattedHistory = historyList.map(item => {
      const historyId = `hist-${item.id}`;
      return {
        id: historyId,
        batchName: item.batch ? item.batch.name : 'Nama Tes Tidak Tersedia',
        completedDate: item.submittedAt, // Sudah dalam format ISO 8601
        score: item.score,
        detailsUrl: `/history/${historyId}`
      };
    });

    res.status(200).json(formattedHistory);
  } catch (error) {
    next(error);
  }
};