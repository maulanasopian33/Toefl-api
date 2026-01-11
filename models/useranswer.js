'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class useranswer extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.batch, { foreignKey: "batchId", as: "batch" });
      this.belongsTo(models.section, { foreignKey: "sectionId", as: "section" });
      this.belongsTo(models.question, { foreignKey: "questionId", as: "question" });
      this.belongsTo(models.option, { foreignKey: "optionId", as: "option" });
    }
  }
  useranswer.init({
    userId: DataTypes.STRING,
    userResultId: DataTypes.INTEGER,
    batchId: DataTypes.STRING,
    sectionId: DataTypes.STRING,
    questionId: DataTypes.STRING,
    optionId: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'useranswer',
  });

  // Helper untuk ambil result
  async function getOrCreateUserResult(userId, batchId) {
    const { userresult } = sequelize.models;
    let result = await userresult.findOne({ where: { userId, batchId } });
    if (!result) {
      result = await userresult.create({ userId, batchId, correctCount: 0, wrongCount: 0, score: 0 });
    }
    return result;
  }

  // 🔥 Hook afterCreate
  useranswer.afterCreate(async (answer, options) => {
    const { option } = sequelize.models;
    try {
      const chosenOption = await option.findByPk(answer.optionId);
      const isCorrect = chosenOption?.isCorrect || false;

      const result = await getOrCreateUserResult(answer.userId, answer.batchId);
      if (isCorrect) {
        result.correctCount += 1;
      } else {
        result.wrongCount += 1;
      }
      result.score = 0; // Score will be calculated by Service or dedicated process
      await result.save();
    } catch (err) {
      console.error('Error in afterCreate hook:', err);
    }
  });

  // 🔥 Hook beforeUpdate → simpan jawaban lama
  useranswer.beforeUpdate(async (answer, options) => {
    const { option } = sequelize.models;
    const oldAnswer = await useranswer.findByPk(answer.id);
    if (oldAnswer) {
      const oldOption = await option.findByPk(oldAnswer.optionId);
      answer._oldIsCorrect = oldOption?.isCorrect || false; // simpan di instance
    }
  });

  // 🔥 Hook afterUpdate → update result berdasar perubahan jawaban
  useranswer.afterUpdate(async (answer, options) => {
    const { option } = sequelize.models;
    try {
      const newOption = await option.findByPk(answer.optionId);
      const newIsCorrect = newOption?.isCorrect || false;
      const oldIsCorrect = answer._oldIsCorrect;

      if (newIsCorrect === oldIsCorrect) {
        return; // tidak ada perubahan skor
      }

      const result = await getOrCreateUserResult(answer.userId, answer.batchId);

      // Update counter
      if (oldIsCorrect && !newIsCorrect) {
        // sebelumnya benar, sekarang salah
        result.correctCount -= 1;
        result.wrongCount += 1;
      } else if (!oldIsCorrect && newIsCorrect) {
        // sebelumnya salah, sekarang benar
        result.correctCount += 1;
        result.wrongCount -= 1;
      }

      result.score = 0; // Score will be recalculated
      await result.save();
    } catch (err) {
      console.error('Error in afterUpdate hook:', err);
    }
  });

  return useranswer;
};