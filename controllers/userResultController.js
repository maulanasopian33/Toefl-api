const { userResult, batch, user } = require('../models');

module.exports = {
  async getAll(req, res) {
    const data = await userResult.findAll({ include: [{ model: batch, as: 'batch' }] });
    res.json(data);
  },

  async getByUser(req, res) {
    const data = await userResult.findAll({
      where: { userId: req.params.userId },
      include: [{ model: batch, as: 'batch' }]
    });
    res.json(data);
  },

  async getByBatch(req, res) {
    const data = await userResult.findAll({
      where: { batchId: req.params.batchId },
      include: [
        { model: user, as: 'user' },
        { model: batch, as: 'batch' }
      ],
      order: [['score', 'DESC']]
    });
    res.json({
      batchId: req.params.batchId,
      results: data
    });
  }
};
