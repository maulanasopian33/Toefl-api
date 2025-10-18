const { userAnswer, option, question } = require('../models');

module.exports = {
  async getAll(req, res) {
    const data = await userAnswer.findAll({ include: [{
      model: option,
      as: 'option',
    }, { model: question, as: 'question' }] });
    res.json(data);
  },

  async create(req, res) {
    try {
      const data = await userAnswer.create(req.body); 
      res.status(201).json(data); // hooks jalan otomatis
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req, res) {
    const data = await userAnswer.findByPk(req.params.id);
    if (!data) return res.status(404).json({ message: 'Answer not found' });
    await data.update(req.body); // hooks jalan otomatis
    res.json(data);
  }
};
