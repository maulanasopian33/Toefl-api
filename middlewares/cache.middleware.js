// middlewares/cache.middleware.js
// Reusable middleware untuk caching response GET endpoint.
// Cara pakai di route:
//   const { cacheMiddleware } = require('../middlewares/cache.middleware');
//   router.get('/settings', checkAuth, cacheMiddleware('settings:global', 300), controller.getSettings);

const { getCache, setCache } = require('../services/cache.service');
const { logger } = require('../utils/logger');

/**
 * Factory function yang menghasilkan Express middleware untuk caching.
 *
 * @param {string} key - Cache key tetap (atau string, bukan fungsi)
 * @param {number} ttl - Time-to-live dalam detik (default: 60)
 * @returns {Function} Express middleware
 *
 * @example
 * // Cache key statis
 * router.get('/settings', checkAuth, cacheMiddleware('settings:global', 300), controller.getSettings);
 *
 * @example
 * // Gunakan dynamicKey untuk key berdasarkan request params
 * router.get('/batch/:id', checkAuth, cacheMiddlewareDynamic((req) => `batch:detail:${req.params.id}`, 30), controller.getBatch);
 */
function cacheMiddleware(key, ttl = 60) {
  return async (req, res, next) => {
    try {
      const cached = await getCache(key);

      if (cached !== null) {
        // Cache HIT
        return res
          .set('X-Cache', 'HIT')
          .set('X-Cache-Key', key)
          .status(200)
          .json(cached);
      }

      // Cache MISS — intercept res.json agar bisa disimpan ke cache
      const originalJson = res.json.bind(res);
      res.json = async function (body) {
        // Hanya cache jika status response sukses (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await setCache(key, body, ttl);
        }
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', key);
        return originalJson(body);
      };

      next();
    } catch (err) {
      // Jika ada error di middleware cache, tetap lanjutkan ke controller
      logger.error(`[CacheMiddleware] Error key="${key}": ${err.message}`);
      next();
    }
  };
}

/**
 * Factory function yang menghasilkan middleware cache dengan dynamic key
 * berdasarkan request object.
 *
 * @param {Function} keyFn - Fungsi (req) => string yang menghasilkan cache key
 * @param {number} ttl - Time-to-live dalam detik (default: 60)
 * @returns {Function} Express middleware
 */
function cacheMiddlewareDynamic(keyFn, ttl = 60) {
  return async (req, res, next) => {
    let key = 'unknown';
    try {
      key = keyFn(req);
      const cached = await getCache(key);

      if (cached !== null) {
        return res
          .set('X-Cache', 'HIT')
          .set('X-Cache-Key', key)
          .status(200)
          .json(cached);
      }

      const originalJson = res.json.bind(res);
      res.json = async function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await setCache(key, body, ttl);
        }
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', key);
        return originalJson(body);
      };

      next();
    } catch (err) {
      logger.error(`[CacheMiddleware] Error key="${key}": ${err.message}`);
      next();
    }
  };
}

module.exports = {
  cacheMiddleware,
  cacheMiddlewareDynamic,
};
