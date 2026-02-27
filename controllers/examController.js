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
              attributes: ['idQuestion', 'text', 'type', 'audioUrl', 'options_alignment'],
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
      attributes: ['idSection', 'namaSection', 'deskripsi', 'urutan', 'scoring_table_id'],
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
        scoring_table_id: section.scoring_table_id,
        audioUrl: section.audioInstructions && section.audioInstructions.length > 0 ? section.audioInstructions[0].audioUrl : null,
        groups: section.groups.map(group => {
          return {
            // 'id' for group is not in the example, but idGroup is useful for FE keys
            id: group.idGroup,
            passage: group.passage, // Frontend will receive HTML escaped
            // Get all audioUrls from audioInstructions
            audioUrls: group.audioInstructions.map(ai => ai.audioUrl),
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
                options_alignment: question.options_alignment || 'LTR',
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
        scoring_table_id: section.scoring_table_id || null,
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

        if (group.audioUrls && Array.isArray(group.audioUrls)) {
          group.audioUrls.forEach((url, index) => {
            if (url) {
              audioInstructionsToUpsert.push({
                groupId: group.id,
                audioUrl: url,
                description: `Audio ${index + 1} for group ${group.id}`,
              });
            }
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
            options_alignment: question.options_alignment || 'LTR',
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

    await db.section.bulkCreate(sectionsToUpsert, { updateOnDuplicate: ["namaSection", "deskripsi", "urutan", "scoring_table_id"], transaction });
    await db.group.bulkCreate(groupsToUpsert, { updateOnDuplicate: ["passage", "sectionId"], transaction });

    if (audioInstructionsToUpsert.length > 0) {
      await db.groupaudioinstruction.bulkCreate(audioInstructionsToUpsert, { transaction });
    }

    if (sectionAudioInstructionsToUpsert.length > 0) {
      await db.sectionaudioinstruction.bulkCreate(sectionAudioInstructionsToUpsert, { transaction });
    }

    await db.question.bulkCreate(questionsToUpsert, { updateOnDuplicate: ["text", "type", "audioUrl", "options_alignment"], transaction });

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
            attributes: ['idBatch', 'name', 'duration_minutes', 'start_date', 'end_date', 'status'],
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

        const now = new Date();
        // Cek apakah tes sudah bisa dimulai
        if (batch.start_date && now < new Date(batch.start_date)) {
            return res.status(403).json({ 
                status: false, 
                message: "Ujian belum dimulai. Silakan cek jadwal Anda.",
                start_date: batch.start_date
            });
        }
        
        // Cek apakah tes sudah berakhir (beri toleransi 15 menit untuk persiapan/loading)
        const closeGrace = 15 * 60 * 1000;
        if (batch.end_date && now > new Date(new Date(batch.end_date).getTime() + closeGrace)) {
             return res.status(403).json({ 
                status: false, 
                message: "Waktu pengerjaan ujian telah berakhir." 
            });
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
      attributes: ['idSection', 'namaSection', 'deskripsi', 'batchId'],
      include: [{
        model: db.batch,
        as: 'batch',
        attributes: ['start_date', 'end_date', 'status']
      },
      {
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

    // --- Validasi Waktu Pengerjaan ---
    const now = new Date();
    const batch = section.batch;
    
    if (batch) {
        if (batch.start_date && now < new Date(batch.start_date)) {
            return res.status(403).json({ 
                status: false, 
                message: "Ujian belum dimulai. Silakan tunggu jadwal yang ditentukan.",
                scheduledStart: batch.start_date 
            });
        }
        if (batch.end_date && now > new Date(batch.end_date)) {
            return res.status(403).json({ 
                status: false, 
                message: "Waktu pengerjaan ujian telah berakhir." 
            });
        }
        if (batch.status === 'FINISHED' || batch.status === 'CLOSED' || batch.status === 'CANCELLED') {
            return res.status(403).json({ 
                status: false, 
                message: `Ujian tidak aktif (Status: ${batch.status}).` 
            });
        }
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
        audioUrls: group.audioInstructions.map(ai => ai.audioUrl),
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

const {
  calculateUserResult,
  getSectionScores
} = require('../services/resultService');

/**
 * [BARU] Menerima jawaban dari pengguna, menghitung skor, dan menyimpan hasil.
 * Route: POST /tests/:testId/submit
 */
exports.submitTest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { testId } = req.params;
    const { answers } = req.body;
    const { uid } = req.user; 

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "Body request tidak valid. 'answers' harus berupa array." });
    }

    // --- Validasi Waktu Submit ---
    const batchCheck = await db.batch.findByPk(testId, { attributes: ['start_date', 'end_date', 'status'] });
    const now = new Date();
    if (batchCheck) {
        // Cek apakah start_date sudah lewat
        if (batchCheck.start_date && now < new Date(batchCheck.start_date)) {
            return res.status(403).json({ 
                status: false, 
                message: "Ujian belum dimulai. Jawaban tidak dapat dikirim." 
            });
        }

        // Beri toleransi 5 menit untuk submit setelah end_date (network delay, dll)
        const gracePeriod = 5 * 60 * 1000; 
        if (batchCheck.end_date && now > new Date(new Date(batchCheck.end_date).getTime() + gracePeriod)) {
             return res.status(403).json({ 
                status: false, 
                message: "Waktu penyerahan jawaban telah berakhir (melewati batas waktu)." 
            });
        }
    }

    // 1. Cari user
    const user = await db.user.findOne({ where: { uid }, attributes: ['uid'], transaction });
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan di database." });
    }
    const localUserId = user.uid;

    // 2. Ambil data pertanyaan untuk mendapatkan sectionId
    const questionIds = answers.map(a => a.questionId);
    const questionsInfo = await db.question.findAll({
      where: { idQuestion: { [Op.in]: questionIds } },
      include: [{ model: db.group, as: 'group', attributes: ['sectionId'] }],
      transaction,
    });

    const questionMap = new Map(questionsInfo.map(q => [q.idQuestion, q.group?.sectionId]));

    // 3. Simpan jawaban ke tabel useranswer
    // Hapus jawaban lama untuk batch ini jika ada (mencegah duplikasi pengerjaan yang tidak rapi)
    await db.useranswer.destroy({
      where: { userId: localUserId, batchId: testId },
      transaction
    });

    const userAnswersToSave = answers.map(answer => ({
      userId: localUserId,
      batchId: testId,
      sectionId: questionMap.get(answer.questionId) || null,
      questionId: answer.questionId,
      optionId: answer.userAnswer,
    }));

    await db.useranswer.bulkCreate(userAnswersToSave, { transaction });

    await transaction.commit();

    // 4. Hitung skor menggunakan ResultService (Logical Centrally)
    const result = await calculateUserResult(localUserId, testId);

    res.status(201).json({
      score: result.score,
      totalQuestions: result.totalQuestions,
      correctCount: result.correctCount,
      wrongCount: result.totalQuestions - result.correctCount,
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    next(error);
  }
};



/**
 * [BARU] Mengambil riwayat hasil tes untuk seorang peserta.
 * Route: GET /history/:historyId
 */
exports.getTestResult = async (req, res, next) => {
  try {
    const { historyId: rawHistoryId } = req.params;
    const { uid } = req.user; 

    // Ekstrak ID numerik
    const historyId = rawHistoryId.split('_').pop();

    // 1. Ambil hasil tes utama
    const userResult = await db.userresult.findOne({
      where: { id: historyId, userId: uid },
      include: [{ model: db.batch, as: 'batch', attributes: ['name', 'scoring_type', 'scoring_config'] }],
    });

    if (!userResult) {
      return res.status(404).json({ message: 'Riwayat tes tidak ditemukan.' });
    }

    // 2. Ambil detail skor per section menggunakan Service
    const sectionScoresMap = await getSectionScores(
      uid,
      userResult.batchId,
      userResult.batch.scoring_type,
      userResult.batch.scoring_config
    );

    const sectionsForResponse = Object.entries(sectionScoresMap).map(([name, score]) => ({
      name,
      score
    }));

    // 3. Ambil detail jawaban untuk tampilan review
    const userAnswers = await db.useranswer.findAll({
      where: { userId: uid, batchId: userResult.batchId },
      include: [
        {
          model: db.question, as: 'question', attributes: ['idQuestion', 'text'],
          include: [
            { model: db.option, as: 'options', attributes: ['idOption', 'text', 'isCorrect'] },
            { model: db.group, as: 'group', include: [{ model: db.section, as: 'section', attributes: ['namaSection'] }] }
          ]
        }
      ]
    });

    const detailedAnswers = userAnswers.map(answer => {
      const question = answer.question;
      const correctOption = question?.options.find(o => o.isCorrect);
      
      return {
        questionId: question?.idQuestion,
        questionText: question?.text,
        userAnswerId: answer.optionId,
        correctAnswerId: correctOption?.idOption,
        isCorrect: answer.optionId === correctOption?.idOption,
        sectionName: question?.group?.section?.namaSection || 'Unknown',
      };
    });

    // 4. Kirim respons
    res.status(200).json({
      testName: userResult.batch.name,
      submittedAt: userResult.submittedAt,
      finalScore: userResult.score,
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