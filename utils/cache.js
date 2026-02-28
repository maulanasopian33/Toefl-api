const NodeCache = require('node-cache');
const { logger } = require('./logger');

// Cache standard TTL: 10 menit (600 detik)
// checkperiod: waktu pengecekan internal untuk menghapus key kedaluwarsa
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

const cacheUtil = {
  get: (key) => {
    const value = cache.get(key);
    if (value) {
      logger.debug(`Cache Hit for key: ${key}`);
    } else {
      logger.debug(`Cache Miss for key: ${key}`);
    }
    return value;
  },
  
  set: (key, value, ttl = 600) => {
    logger.debug(`Cache Set for key: ${key}`);
    return cache.set(key, value, ttl);
  },
  
  del: (key) => {
    logger.debug(`Cache Del for key: ${key}`);
    return cache.del(key);
  },

  delByPrefix: (prefix) => {
    const keys = cache.keys();
    const keysToDelete = keys.filter(k => k.startsWith(prefix));
    if (keysToDelete.length > 0) {
       logger.debug(`Cache Del keys by prefix ${prefix}: ${keysToDelete.join(', ')}`);
       cache.del(keysToDelete);
    }
  },
  
  flush: () => {
    logger.debug(`Cache Flushed`);
    return cache.flushAll();
  }
};

module.exports = cacheUtil;
