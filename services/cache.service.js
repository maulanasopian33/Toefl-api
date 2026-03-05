// services/cache.service.js
// Abstraksi layer untuk semua operasi Redis cache.
// Setiap method mem-fallback ke null/false jika Redis tidak tersedia,
// sehingga controller tetap berjalan mengambil data dari DB.

const { client, isRedisReady } = require('../config/redis');
const { logger } = require('../utils/logger');

// Batas ukuran value yang diizinkan untuk di-cache (512 KB)
const MAX_CACHE_SIZE_BYTES = 512 * 1024;

/**
 * Mengambil nilai dari cache berdasarkan key.
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Data ter-parse atau null jika miss/error
 */
async function getCache(key) {
  if (!isRedisReady()) return null;
  try {
    const data = await client.get(key);
    if (data === null) {
      logger.debug(`[Cache] MISS key="${key}"`);
      return null;
    }
    logger.debug(`[Cache] HIT key="${key}"`);
    return JSON.parse(data);
  } catch (err) {
    logger.error(`[Cache] getCache error for key="${key}": ${err.message}`);
    return null; // Graceful fallback
  }
}

/**
 * Menyimpan nilai ke cache dengan TTL.
 * @param {string} key - Cache key
 * @param {any} value - Nilai yang akan di-cache (akan di-serialize ke JSON)
 * @param {number} ttl - Time-to-live dalam detik
 * @returns {Promise<boolean>} - true jika berhasil, false jika tidak
 */
async function setCache(key, value, ttl = 60) {
  if (!isRedisReady()) return false;
  try {
    const serialized = JSON.stringify(value);

    // Guard: jangan cache object yang terlalu besar
    if (serialized.length > MAX_CACHE_SIZE_BYTES) {
      logger.warn(`[Cache] Skipped setCache: key="${key}" terlalu besar (${(serialized.length / 1024).toFixed(1)} KB > 512 KB)`);
      return false;
    }

    await client.setex(key, ttl, serialized);
    logger.debug(`[Cache] SET key="${key}" TTL=${ttl}s`);
    return true;
  } catch (err) {
    logger.error(`[Cache] setCache error for key="${key}": ${err.message}`);
    return false; // Graceful fallback
  }
}

/**
 * Menghapus satu cache key.
 * @param {string} key - Cache key yang akan dihapus
 * @returns {Promise<boolean>}
 */
async function deleteCache(key) {
  if (!isRedisReady()) return false;
  try {
    const result = await client.del(key);
    logger.debug(`[Cache] DEL key="${key}" result=${result}`);
    return result > 0;
  } catch (err) {
    logger.error(`[Cache] deleteCache error for key="${key}": ${err.message}`);
    return false;
  }
}

/**
 * Menghapus semua cache key yang cocok dengan pola (glob pattern).
 * Menggunakan SCAN untuk non-blocking (aman di production).
 * @param {string} pattern - Glob pattern, misalnya "product:*" atau "exam:data:*"
 * @returns {Promise<number>} - Jumlah key yang dihapus
 */
async function clearByPattern(pattern) {
  if (!isRedisReady()) return 0;
  try {
    let cursor = '0';
    let deletedCount = 0;

    do {
      // SCAN dengan batchSize 100 agar tidak block event loop
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    logger.info(`[Cache] clearByPattern pattern="${pattern}" deleted=${deletedCount} keys`);
    return deletedCount;
  } catch (err) {
    logger.error(`[Cache] clearByPattern error for pattern="${pattern}": ${err.message}`);
    return 0;
  }
}

/**
 * Mendapatkan sisa TTL (detik) dari sebuah cache key.
 * @param {string} key - Cache key
 * @returns {Promise<number>} - TTL dalam detik, -1 jika tidak ada TTL, -2 jika key tidak ada
 */
async function getCacheTTL(key) {
  if (!isRedisReady()) return -2;
  try {
    return await client.ttl(key);
  } catch (err) {
    logger.error(`[Cache] getCacheTTL error for key="${key}": ${err.message}`);
    return -2;
  }
}

/**
 * Menghapus semua key dalam Redis DB saat ini.
 * PERHATIAN: Hanya gunakan di admin endpoint yang dilindungi!
 * @returns {Promise<boolean>}
 */
async function clearAll() {
  if (!isRedisReady()) return false;
  try {
    await client.flushdb();
    logger.info('[Cache] clearAll: All cache keys flushed (FLUSHDB).');
    return true;
  } catch (err) {
    logger.error(`[Cache] clearAll error: ${err.message}`);
    return false;
  }
}

module.exports = {
  getCache,
  setCache,
  deleteCache,
  clearByPattern,
  getCacheTTL,
  clearAll,
};
