// controllers/examController.js

const { Op } = require('sequelize');
const db = require('../models');
const { sequelize } = require('../models');
const { logger } = require('../utils/logger');

/**
 * Mengambil seluruh data ujian (sections, groups, questions, options)
 * berdasarkan ID batch.
 */
exports.getExamData = async (req, res, next) => {
  try {
    const { examId } = req.params;

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
              attributes: ['idQuestion', 'text', 'type'],
            },
            {
              model: db.groupAudioInstruction,
              as: 'audioInstructions',
              attributes: ['audioUrl'],
            },
          ], // Include idGroup for keying in FE
          attributes: ['idGroup', 'passage'],
        },
      ], // Add attributes from section model
      attributes: ['idSection', 'namaSection', 'deskripsi'],
      order: [
        ['idSection', 'ASC'],
        [{ model: db.group, as: 'groups' }, 'idGroup', 'ASC'],
        [{ model: db.group, as: 'groups' }, { model: db.question, as: 'questions' }, 'idQuestion', 'ASC'],
        [{ model: db.group, as: 'groups' }, { model: db.question, as: 'questions' }, { model: db.option, as: 'options' }, 'idOption', 'ASC'],
      ],
    });

    if (!sections || sections.length === 0) {
      return res.status(404).json({ message: `Ujian dengan ID ${examId} tidak ditemukan.` });
    }

    // Format data sesuai ekspektasi frontend
    const formattedData = sections.map(section => {
      return {
        id: section.idSection,
        name: section.namaSection,
        type: section.namaSection, // Use namaSection for type as well
        instructions: section.deskripsi, // Frontend will receive HTML escaped
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
                options: question.options.map(opt => opt.text),
                correctAnswer: correctOption ? correctOption.text : null,
                userAnswer: null, // Add userAnswer as requested by FE structure
              };
            }),
          };
        }),
      };
    });

    res.status(200).json(formattedData);
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

    for (const section of sectionsData) {
      incomingSectionIds.push(section.id);
      sectionsToUpsert.push({
        idSection: section.id,
        namaSection: section.name,
        deskripsi: section.instructions,
        batchId,
      });

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
          });

          for (const optionText of question.options) {
            // Buat ID unik dan deterministik untuk opsi
            const idOption = `${question.id}-${optionText.substring(0, 10).replace(/\s/g, '')}`;
            optionsToUpsert.push({
              idOption,
              text: optionText,
              isCorrect: optionText === question.correctAnswer,
              questionId: question.id,
            });
          }
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
      await db.groupAudioInstruction.destroy({ where: { groupId: { [Op.in]: incomingGroupIds } }, transaction });
    }

    // Hapus Groups yang tidak ada di payload untuk batch ini
    await db.group.destroy({ where: { batchId: batchId, idGroup: { [Op.notIn]: incomingGroupIds } }, transaction });

    // Hapus Sections yang tidak ada di payload untuk batch ini
    await db.section.destroy({ where: { batchId: batchId, idSection: { [Op.notIn]: incomingSectionIds } }, transaction });

    // --- 3. Upsert (Update or Insert) data baru (Upsert phase) ---
    // Urutan: dari induk ke anak.

    await db.section.bulkCreate(sectionsToUpsert, { updateOnDuplicate: ["namaSection", "deskripsi"], transaction });
    await db.group.bulkCreate(groupsToUpsert, { updateOnDuplicate: ["passage", "sectionId"], transaction });

    if (audioInstructionsToUpsert.length > 0) {
      await db.groupAudioInstruction.bulkCreate(audioInstructionsToUpsert, { transaction });
    }

    await db.question.bulkCreate(questionsToUpsert, { updateOnDuplicate: ["text", "type"], transaction });

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
  try {
    const { testId } = req.params;

    // 1. Cari data tes (batch) berdasarkan ID
    const test = await db.batch.findByPk(testId, {
      attributes: ['idBatch', 'namaBatch', 'durasi'],
    });

    if (!test) {
      return res.status(404).json({ message: `Tes dengan ID ${testId} tidak ditemukan.` });
    }

    // 2. Ambil semua bagian (sections) yang terkait, diurutkan
    const sections = await db.section.findAll({
      where: { batchId: testId },
      attributes: ['idSection', 'namaSection'],
      order: [['idSection', 'ASC']], // Diasumsikan urutan berdasarkan ID
    });

    // 3. Format output JSON sesuai permintaan
    const response = {
      id: test.idBatch,
      name: test.namaBatch,
      totalTime: test.durasi, // total waktu tes dalam detik
      sectionOrder: sections.map(section => ({
        id: section.idSection,
        name: section.namaSection,
      })),
    };

    res.status(200).json(response);
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
        model: db.group,
        as: 'groups',
        attributes: ['idGroup', 'passage'],
        include: [{
            model: db.groupAudioInstruction,
            as: 'audioInstructions',
            attributes: ['audioUrl'],
          },
          {
            model: db.question,
            as: 'questions',
            attributes: ['idQuestion', 'text'], // 'text' adalah 'question'
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
      // audioInstructions tidak ada di model section, jadi null
      audioInstructions: null,
      groups: section.groups.map(group => ({
        id: group.idGroup,
        passage: group.passage,
        audioUrl: group.audioInstructions.length > 0 ? group.audioInstructions[0].audioUrl : null,
        questions: group.questions.map(question => ({
          id: question.idQuestion,
          question: question.text,
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
    const { uid: userId } = req.user;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "Body request tidak valid. 'answers' harus berupa array." });
    }

    const questionIds = answers.map(a => a.questionId);

    // Ambil semua kunci jawaban untuk pertanyaan yang relevan dalam satu query
    const correctAnswers = await db.option.findAll({
      where: {
        questionId: { [Op.in]: questionIds },
        isCorrect: true,
      },
      attributes: ['questionId', 'idOption'],
      transaction,
    });

    // Buat map untuk pencarian cepat: { questionId: correctOptionId }
    const answerKey = new Map(correctAnswers.map(a => [a.questionId, a.idOption]));

    // Hitung skor
    let score = 0;
    for (const answer of answers) {
      if (answerKey.has(answer.questionId) && answerKey.get(answer.questionId) === answer.userAnswer) {
        score++;
      }
    }

    // Simpan hasil ke tabel userResult (sesuai dengan struktur yang ada)
    const testResult = await db.userResult.create({
      userId,
      batchId: testId,
      score: score,
      completedAt: new Date(),
      // totalQuestions bisa ditambahkan jika perlu
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      score: score,
      totalQuestions: answers.length,
      testResultId: testResult.id,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};