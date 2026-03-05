const { question } = require('../models');
const { getCache, setCache, deleteCache, clearByPattern } = require('../services/cache.service');

const QUESTION_CACHE_PREFIX = 'question:';
const QUESTION_CACHE_TTL = 1800; // 30 menit

module.exports = {
  async getAll(req, res) {
    const cacheKey = `${QUESTION_CACHE_PREFIX}all`;
    const cached = await getCache(cacheKey);
    if (cached) return res.set('X-Cache', 'HIT').json(cached);

    const data = await question.findAll();
    const responseData = { status: true, data };
    await setCache(cacheKey, responseData, QUESTION_CACHE_TTL);
    res.set('X-Cache', 'MISS').json(responseData);
  },

  async getById(req, res) {
    const { id } = req.params;
    const cacheKey = `${QUESTION_CACHE_PREFIX}detail:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.set('X-Cache', 'HIT').json(cached);

    const data = await question.findByPk(id);
    if (!data) return res.status(404).json({ message: 'Question not found' });
    
    const responseData = { status: true, data };
    await setCache(cacheKey, responseData, QUESTION_CACHE_TTL);
    res.set('X-Cache', 'MISS').json(responseData);
  },

  async create(req, res) {
    try {
      const data = await question.create(req.body);
      
      // Invalidate cache
      await clearByPattern(`${QUESTION_CACHE_PREFIX}*`);
      
      res.status(201).json({ status: true, data });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req, res) {
    const { id } = req.params;
    const data = await question.findByPk(id);
    if (!data) return res.status(404).json({ message: 'Question not found' });
    
    await data.update(req.body);
    
    // Invalidate cache
    await Promise.all([
      clearByPattern(`${QUESTION_CACHE_PREFIX}all`),
      deleteCache(`${QUESTION_CACHE_PREFIX}detail:${id}`)
    ]);

    res.json({ status: true, data });
  },

  async delete(req, res) {
    const { id } = req.params;
    const data = await question.findByPk(id);
    if (!data) return res.status(404).json({ message: 'Question not found' });
    
    await data.destroy();
    
    // Invalidate cache
    await Promise.all([
      clearByPattern(`${QUESTION_CACHE_PREFIX}all`),
      deleteCache(`${QUESTION_CACHE_PREFIX}detail:${id}`)
    ]);

    res.json({ status: true, message: 'Question deleted' });
  }
};
