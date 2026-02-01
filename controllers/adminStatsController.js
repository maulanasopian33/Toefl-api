const { batch, group, question, groupaudioinstruction: groupAudioInstruction, payment, user, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.getStats = async (req, res) => {
  try {
    const [
      batchCount,
      activeBatchCount,
      finishedBatchCount,
      groupCount,
      questionCount,
      audioCount,
      userCount,
      recentUsers,
      recentPayments
    ] = await Promise.all([
      batch.count(),
      batch.count({ where: { status: 'OPEN' } }), // Asumsi status aktif = OPEN
      batch.count({ where: { status: 'FINISHED' } }),
      group.count(),
      question.count(),
      groupAudioInstruction.count(),
      user.count(),
      user.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        attributes: ['name', 'email', 'createdAt']
      }),
      payment.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        // include: [{ model: user, as: 'user', attributes: ['name', 'email'] }], // Removed due to missing direct association
        attributes: ['amount', 'status', 'createdAt']
      })
    ]);

    // Trend user monthly (simple 6 months back)
    // Note: Complex aggregation is better done with raw query for performance on large datasets
    // For now, returning simple counts.

    res.json({
      status: true,
      data: {
        counts: {
          batch: batchCount,
          activeBatch: activeBatchCount,
          finishedBatch: finishedBatchCount,
          group: groupCount,
          question: questionCount,
          audio: audioCount,
          user: userCount
        },
        recentActivity: {
          users: recentUsers,
          payments: recentPayments
        }
      }
    });
  } catch (err) {
    console.error('Error getStats:', err);
    res.status(500).json({ message: 'Server error parsing stats' });
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
