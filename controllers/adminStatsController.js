const { batch, group, question, groupAudioInstruction, payment, sequelize } = require('../models');
const { Op } = require('sequelize');

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

exports.getFinancialRecap = async (req, res, next) => {
  try {
    const { startDate, endDate, batchId } = req.query;

    // Build filter condition
    const whereCondition = {};
    if (startDate && endDate) {
      whereCondition.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }
    if (batchId) {
      // This requires a join, so we'll add it to the include
    }

    const recap = await payment.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'paid' THEN amount ELSE 0 END")), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'pending' THEN amount ELSE 0 END")), 'totalPending'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'paid' THEN 1 ELSE NULL END")), 'paidTransactionsCount'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'pending' THEN 1 ELSE NULL END")), 'pendingTransactionsCount'],
      ],
      where: whereCondition,
      // Include batch for filtering if batchId is provided
      include: batchId ? [{
        model: require('../models').batchparticipant,
        as: 'participant',
        attributes: [],
        where: { batchId: batchId },
        required: true
      }] : [],
      raw: true, // Get plain JSON object
    });

    res.status(200).json({ status: true, message: 'Rekap keuangan berhasil diambil.', data: recap[0] });
  } catch (error) {
    next(error);
  }
};
