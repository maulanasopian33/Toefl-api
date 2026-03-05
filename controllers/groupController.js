const { group, question } = require('../models');
const { getCache, setCache, deleteCache, clearByPattern } = require('../services/cache.service');

const GROUP_CACHE_PREFIX = 'group:';
const GROUP_CACHE_TTL = 3600; // 1 jam

// Get all groups (include questions)
exports.getAll = async (req, res) => {
  try {
    const cacheKey = `${GROUP_CACHE_PREFIX}all`;
    const cached = await getCache(cacheKey);
    if (cached) return res.set('X-Cache', 'HIT').json(cached);

    const groups = await group.findAll({
      include: [{ model: question, as: 'questions' }],
    });
    
    const responseData = { status: true, data: groups };
    await setCache(cacheKey, responseData, GROUP_CACHE_TTL);
    res.set('X-Cache', 'MISS').json(responseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get group by id
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `${GROUP_CACHE_PREFIX}detail:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.set('X-Cache', 'HIT').json(cached);

    const g = await group.findByPk(id, {
      include: [{ model: question, as: 'questions' }],
    });
    if (!g) return res.status(404).json({ error: 'Group not found' });
    
    const responseData = { status: true, data: g };
    await setCache(cacheKey, responseData, GROUP_CACHE_TTL);
    res.set('X-Cache', 'MISS').json(responseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new group
exports.create = async (req, res) => {
  try {
    const newGroup = await group.create(req.body);
    
    // Invalidate cache
    await clearByPattern(`${GROUP_CACHE_PREFIX}*`);

    res.status(201).json({ status: true, data: newGroup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update group
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const g = await group.findByPk(id);
    if (!g) return res.status(404).json({ error: 'Group not found' });
    
    await g.update(req.body);

    // Invalidate cache
    await Promise.all([
      clearByPattern(`${GROUP_CACHE_PREFIX}all`),
      deleteCache(`${GROUP_CACHE_PREFIX}detail:${id}`)
    ]);

    res.json({ status: true, data: g });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete group
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const g = await group.findByPk(id);
    if (!g) return res.status(404).json({ error: 'Group not found' });
    
    await g.destroy();

    // Invalidate cache
    await Promise.all([
      clearByPattern(`${GROUP_CACHE_PREFIX}all`),
      deleteCache(`${GROUP_CACHE_PREFIX}detail:${id}`)
    ]);

    res.json({ status: true, message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
