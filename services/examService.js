// services/examService.js
const { Op } = require('sequelize');
const db = require('../models');
const { sequelize } = require('../models');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

/**
 * Service to handle complex exam data updates.
 */
exports.updateExamDataTransaction = async (batchId, sectionsData, userEmail) => {
  const transaction = await sequelize.transaction();
  try {
    // --- 0. Cek Locking ---
    const batch = await db.batch.findByPk(batchId, { attributes: ['start_date'] });
    const submissionCount = await db.userresult.count({ where: { batchId } });
    const isLocked = submissionCount > 0 || (batch?.start_date && new Date(batch.start_date) <= new Date());

    if (isLocked) {
      throw { status: 403, message: "Ujian terkunci karena sudah ada pengerjaan atau waktu ujian telah dimulai." };
    }

    if (!Array.isArray(sectionsData)) {
      throw { status: 400, message: "Struktur data yang dikirim tidak valid. Body harus berupa array." };
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
        urutan: sectionIndex,
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
          batchId,
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

    // --- 2. Hapus data lama (Delete phase) ---
    if (incomingQuestionIds.length > 0) {
      await db.option.destroy({ where: { questionId: { [Op.in]: incomingQuestionIds } }, transaction });
    }

    const questionsToDelete = await db.question.findAll({
      attributes: ['idQuestion'],
      where: { idQuestion: { [Op.notIn]: incomingQuestionIds } },
      include: [{
        model: db.group, as: 'group', attributes: [], required: true,
        where: { batchId }
      }],
      transaction
    });
    const questionIdsToDelete = questionsToDelete.map(q => q.idQuestion);
    if (questionIdsToDelete.length > 0) {
      await db.option.destroy({ where: { questionId: { [Op.in]: questionIdsToDelete } }, transaction });
      await db.question.destroy({ where: { idQuestion: { [Op.in]: questionIdsToDelete } }, transaction });
    }

    if (incomingGroupIds.length > 0) {
      await db.groupaudioinstruction.destroy({ where: { groupId: { [Op.in]: incomingGroupIds } }, transaction });
    }

    if (incomingSectionIds.length > 0) {
      await db.sectionaudioinstruction.destroy({ where: { sectionId: { [Op.in]: incomingSectionIds } }, transaction });
    }

    await db.group.destroy({ where: { batchId: batchId, idGroup: { [Op.notIn]: incomingGroupIds } }, transaction });
    await db.section.destroy({ where: { batchId: batchId, idSection: { [Op.notIn]: incomingSectionIds } }, transaction });

    // --- 3. Upsert data baru (Upsert phase) ---
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
      user: userEmail,
      details: { batchId }
    });

    return { success: true, incomingSectionIds };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
};
