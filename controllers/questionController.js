const { question } = require('../models');

module.exports = {
  async getAll(req, res) {
    const data = await question.findAll();
    res.json(data);
  },

  async getById(req, res) {
    const data = await question.findByPk(req.params.id);
    if (!data) return res.status(404).json({ message: 'Question not found' });
    res.json(data);
  },

  async create(req, res) {
    try {
      const data = await question.create(req.body);
      res.status(201).json(data);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req, res) {
    const data = await question.findByPk(req.params.id);
    if (!data) return res.status(404).json({ message: 'Question not found' });
    await data.update(req.body);
    res.json(data);
  },

  async delete(req, res) {
    const data = await question.findByPk(req.params.id);
    if (!data) return res.status(404).json({ message: 'Question not found' });
    await data.destroy();
    res.json({ message: 'Question deleted' });
  }
};
