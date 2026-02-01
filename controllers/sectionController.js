const { section, group, question, option, groupaudioinstruction, sectionaudioinstruction } = require('../models');

// Get all sections (include groups)
exports.getAll = async (req, res) => {
  try {
    const sections = await section.findAll({
      include: [{ model: group, as: 'groups' }],
    });
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get section by id
exports.getById = async (req, res) => {
  try {
    const sec = await section.findByPk(req.params.id, {
      include: [
        {
          model: sectionaudioinstruction,
          as: 'audioInstructions',
          attributes: ['audioUrl']
        },
        {
          model: group,
          as: 'groups',
          include: [
            {
              model: groupaudioinstruction,
              as: 'audioInstructions',
              attributes: ['audioUrl']
            },
            {
              model: question,
              as: 'questions',
              include: [
                {
                  model: option,
                  as: 'options',
                  attributes: ['idOption', 'text', 'isCorrect'] // Include key fields
                }
              ]
            }
          ]
        }
      ],
      order: [
        [{ model: group, as: 'groups' }, 'idGroup', 'ASC'],
        [{ model: group, as: 'groups' }, { model: question, as: 'questions' }, 'idQuestion', 'ASC'],
        [{ model: group, as: 'groups' }, { model: question, as: 'questions' }, { model: option, as: 'options' }, 'idOption', 'ASC']
      ]
    });
    if (!sec) return res.status(404).json({ error: 'Section not found' });
    res.json(sec);
  } catch (err) {
    console.error("Error getById section:", err);
    res.status(500).json({ error: err.message });
  }
};

// Create new section
exports.create = async (req, res) => {
  try {
    const newSection = await section.create(req.body);
    res.status(201).json(newSection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update section
exports.update = async (req, res) => {
  try {
    const sec = await section.findByPk(req.params.id);
    if (!sec) return res.status(404).json({ error: 'Section not found' });
    await sec.update(req.body);
    res.json(sec);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete section
exports.remove = async (req, res) => {
  try {
    const sec = await section.findByPk(req.params.id);
    if (!sec) return res.status(404).json({ error: 'Section not found' });
    await sec.destroy();
    res.json({ message: 'Section deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
