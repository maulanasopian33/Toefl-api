const { group, question } = require('../models');

// Get all groups (include questions)
exports.getAll = async (req, res) => {
  try {
    const groups = await group.findAll({
      include: [{ model: question, as: 'questions' }],
    });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get group by id
exports.getById = async (req, res) => {
  try {
    const g = await group.findByPk(req.params.id, {
      include: [{ model: question, as: 'questions' }],
    });
    if (!g) return res.status(404).json({ error: 'Group not found' });
    res.json(g);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new group
exports.create = async (req, res) => {
  try {
    const newGroup = await group.create(req.body);
    res.status(201).json(newGroup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update group
exports.update = async (req, res) => {
  try {
    const g = await group.findByPk(req.params.id);
    if (!g) return res.status(404).json({ error: 'Group not found' });
    await g.update(req.body);
    res.json(g);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete group
exports.remove = async (req, res) => {
  try {
    const g = await group.findByPk(req.params.id);
    if (!g) return res.status(404).json({ error: 'Group not found' });
    await g.destroy();
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
