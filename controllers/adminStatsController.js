const { batch, group, question, groupAudioInstruction } = require('../models');

exports.getStats = async (req, res) => {
  try {
    const batchCount   = await batch.count();
    const groupCount   = await group.count();
    const questionCount= await question.count();
    const audioCount   = await groupAudioInstruction.count();

    res.json({
      batchCount,
      groupCount,
      questionCount,
      audioCount
    });
  } catch (err) {
    console.error('Error getStats:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
