const { batch, group, question, groupaudioinstruction: groupAudioInstruction, payment, user, sequelize, batchparticipant, paymentproof } = require('../models');
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
      recentPayments,
      queuePending,
      queueFailed
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
        attributes: ['name', 'email', 'createdAt'],
        include: [{ model: require('../models').detailuser, as: 'detailuser' }]
      }),
      payment.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        // include: [{ model: user, as: 'user', attributes: ['name', 'email'] }], // Removed due to missing direct association
        attributes: ['amount', 'status', 'createdAt']
      }),
      require('../models').userresult.count({ where: { status: 'PENDING' } }),
      require('../models').userresult.count({ where: { status: 'FAILED' } })
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
          user: userCount,
          queuePending,
          queueFailed
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

    const whereCondition = {};
    if (startDate && endDate) {
      whereCondition.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const participantWhere = {};
    if (batchId) {
      participantWhere.batchId = batchId;
    }

    // 1. Summary Information
    const summary = await payment.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'paid' THEN amount ELSE 0 END")), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'pending' THEN amount ELSE 0 END")), 'totalPending'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'failed' OR status = 'refunded' THEN amount ELSE 0 END")), 'totalLoss'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'paid' THEN 1 ELSE NULL END")), 'paidCount'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'pending' THEN 1 ELSE NULL END")), 'pendingCount'],
      ],
      where: whereCondition,
      include: [
        {
          model: batchparticipant,
          as: 'participant',
          attributes: [],
          where: participantWhere,
          required: Object.keys(participantWhere).length > 0
        }
      ],
      raw: true,
    });

    // 2. Revenue Trend (Daily for the last 30 days or based on range)
    const trend = await payment.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('payment.createdAt')), 'date'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'amount'],
      ],
      where: { ...whereCondition, status: 'paid' },
      include: [
        {
          model: batchparticipant,
          as: 'participant',
          attributes: [],
          where: participantWhere,
          required: Object.keys(participantWhere).length > 0
        }
      ],
      group: [sequelize.fn('DATE', sequelize.col('payment.createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('payment.createdAt')), 'ASC']],
      raw: true,
    });

    // 3. Batch Breakdown
    const batchBreakdown = await payment.findAll({
      attributes: [
        [sequelize.col('participant.batch.name'), 'batchName'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN payment.status = 'paid' THEN amount ELSE 0 END")), 'revenue'],
        [sequelize.fn('COUNT', sequelize.col('payment.id')), 'transactionCount'],
      ],
      where: whereCondition,
      include: [
        {
          model: batchparticipant,
          as: 'participant',
          attributes: [],
          required: true,
          include: [{ model: batch, as: 'batch', attributes: [] }]
        }
      ],
      group: [sequelize.col('participant.batch.idBatch'), sequelize.col('participant.batch.name')], // Changed to idBatch and name
      raw: true,
    });

    // 4. Method Breakdown
    const methodBreakdown = await payment.findAll({
      attributes: [
        'method',
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'paid' THEN amount ELSE 0 END")), 'revenue'],
        [sequelize.fn('COUNT', sequelize.col('payment.id')), 'count'],
      ],
      where: whereCondition,
      include: [
        {
          model: require('../models').batchparticipant,
          as: 'participant',
          attributes: [],
          where: participantWhere,
          required: Object.keys(participantWhere).length > 0
        }
      ],
      group: ['method'],
      raw: true,
    });

    res.status(200).json({
      status: true,
      message: 'Laporan keuangan berhasil diambil.',
      data: {
        summary: summary[0],
        trend,
        batchBreakdown,
        methodBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
};
