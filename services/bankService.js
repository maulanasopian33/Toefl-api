const { section, group, question, option, sequelize } = require('../models');
const { v4: uuidv4 } = require('uuid');

/**
 * BankService handles Question Bank operations like section cloning.
 */
class BankService {
  /**
   * Deep clones a section (including groups, questions, and options).
   * If targetBatchId is null, it creates a standalone "Bank" section.
   * 
   * @param {string} sourceSectionId - The ID of the section to clone.
   * @param {string|null} targetBatchId - The ID of the target batch, or null for Bank Soal.
   * @returns {Promise<Object>} - The newly created section instance.
   */
  static async cloneSection(sourceSectionId, targetBatchId = null) {
    const transaction = await sequelize.transaction();
    try {
      // 1. Fetch source section with all nested data
      const source = await section.findByPk(sourceSectionId, {
        include: [
          {
            model: group,
            as: 'groups',
            include: [
              {
                model: question,
                as: 'questions',
                include: [
                  { model: option, as: 'options' }
                ]
              }
            ]
          }
        ],
        transaction
      });

      if (!source) throw new Error('Source section not found');

      // 2. Create new Section
      const newSectionId = `sec_${uuidv4().substring(0, 8)}`;
      const newSection = await section.create({
        idSection: newSectionId,
        namaSection: `${source.namaSection}${targetBatchId ? '' : ' (Template)'}`,
        deskripsi: source.deskripsi,
        urutan: source.urutan,
        batchId: targetBatchId,
        scoring_table_id: source.scoring_table_id
      }, { transaction });

      // 3. Clone Groups
      for (const srcGroup of source.groups) {
        const newGroupId = `grp_${uuidv4().substring(0, 8)}`;
        const newGroup = await group.create({
          idGroup: newGroupId,
          passage: srcGroup.passage,
          batchId: targetBatchId,
          sectionId: newSectionId
        }, { transaction });

        // 4. Clone Questions
        for (const srcQuestion of srcGroup.questions) {
          const newQuestionId = `qst_${uuidv4().substring(0, 8)}`;
          const newQuestion = await question.create({
            idQuestion: newQuestionId,
            text: srcQuestion.text,
            type: srcQuestion.type,
            groupId: newGroupId,
            sectionId: newSectionId
          }, { transaction });

          // 5. Clone Options
          if (srcQuestion.options && srcQuestion.options.length > 0) {
            const optionsToCreate = srcQuestion.options.map(opt => ({
              idOption: `opt_${uuidv4().substring(0, 8)}`,
              text: opt.text,
              isCorrect: opt.isCorrect,
              questionId: newQuestionId
            }));
            await option.bulkCreate(optionsToCreate, { transaction });
          }
        }
      }

      await transaction.commit();
      return newSection;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * List all template sections (where batchId is null).
   */
  static async getTemplates() {
    return await section.findAll({
      where: { batchId: null },
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = BankService;
