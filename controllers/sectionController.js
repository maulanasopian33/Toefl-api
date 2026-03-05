const { section, group, question, option, groupaudioinstruction, sectionaudioinstruction } = require('../models');
const { getCache, setCache, deleteCache, clearByPattern } = require('../services/cache.service');

const SECTION_CACHE_PREFIX = 'section:';
const SECTION_CACHE_TTL = 3600; // 1 jam

// Get all sections (include groups)
exports.getAll = async (req, res) => {
  try {
    const cacheKey = `${SECTION_CACHE_PREFIX}all`;
    const cached = await getCache(cacheKey);
    if (cached) return res.set('X-Cache', 'HIT').json(cached);

    const sections = await section.findAll({
      include: [{ model: group, as: 'groups' }],
      order: [['urutan', 'ASC']]
    });
    
    const responseData = { status: true, data: sections };
    await setCache(cacheKey, responseData, SECTION_CACHE_TTL);
    res.set('X-Cache', 'MISS').json(responseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get section by id
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `${SECTION_CACHE_PREFIX}detail:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.set('X-Cache', 'HIT').json(cached);

    const sec = await section.findByPk(id, {
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
                  attributes: ['idOption', 'text', 'isCorrect']
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
    
    const responseData = { status: true, data: sec };
    await setCache(cacheKey, responseData, SECTION_CACHE_TTL);
    res.set('X-Cache', 'MISS').json(responseData);
  } catch (err) {
    console.error("Error getById section:", err);
    res.status(500).json({ error: err.message });
  }
};

// Create new section
exports.create = async (req, res) => {
  try {
    const newSection = await section.create(req.body);
    
    // Invalidate cache
    await clearByPattern(`${SECTION_CACHE_PREFIX}*`);

    res.status(201).json({ status: true, data: newSection });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update section
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const sec = await section.findByPk(id);
    if (!sec) return res.status(404).json({ error: 'Section not found' });
    
    await sec.update(req.body);

    // Invalidate cache
    await Promise.all([
      clearByPattern(`${SECTION_CACHE_PREFIX}all`),
      deleteCache(`${SECTION_CACHE_PREFIX}detail:${id}`)
    ]);

    res.json({ status: true, data: sec });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete section
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const sec = await section.findByPk(id);
    if (!sec) return res.status(404).json({ error: 'Section not found' });
    
    await sec.destroy();

    // Invalidate cache
    await Promise.all([
      clearByPattern(`${SECTION_CACHE_PREFIX}all`),
      deleteCache(`${SECTION_CACHE_PREFIX}detail:${id}`)
    ]);

    res.json({ status: true, message: 'Section deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
