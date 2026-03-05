// controllers/cacheController.js
// Admin-only endpoints untuk monitoring dan manajemen Redis cache.

const { client, isRedisReady } = require('../config/redis');
const { clearAll, clearByPattern } = require('../services/cache.service');
const { logger } = require('../utils/logger');

/**
 * GET /admin/cache/status
 * Mengembalikan informasi status Redis: koneksi, memory, total keys, hit rate, dll.
 */
exports.getStatus = async (req, res, next) => {
  try {
    if (!isRedisReady()) {
      return res.status(200).json({
        status: true,
        message: 'Redis tidak tersedia (offline). Sistem berjalan tanpa cache.',
        data: {
          connected: false,
          redis_status: client ? client.status : 'not_initialized',
        },
      });
    }

    // Ambil INFO dari Redis
    const info = await client.info();

    // Parse INFO string menjadi objek key-value
    const infoMap = {};
    info.split('\r\n').forEach((line) => {
      if (line && !line.startsWith('#')) {
        const [k, v] = line.split(':');
        if (k && v !== undefined) infoMap[k.trim()] = v.trim();
      }
    });

    // Ambil total keys dari keyspace
    const dbKey = `db${process.env.REDIS_DB || '0'}`;
    const keyspaceRaw = infoMap[dbKey] || '';
    let totalKeys = 0;
    if (keyspaceRaw) {
      const match = keyspaceRaw.match(/keys=(\d+)/);
      if (match) totalKeys = parseInt(match[1], 10);
    }

    // Hitung hit rate
    const hits = parseInt(infoMap['keyspace_hits'] || '0', 10);
    const misses = parseInt(infoMap['keyspace_misses'] || '0', 10);
    const total = hits + misses;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) + '%' : 'N/A';

    const memoryUsageBytes = parseInt(infoMap['used_memory'] || '0', 10);
    const maxMemoryBytes = parseInt(infoMap['maxmemory'] || '0', 10);

    return res.status(200).json({
      status: true,
      message: 'Redis cache status berhasil diambil.',
      data: {
        connected: true,
        redis_version: infoMap['redis_version'] || 'unknown',
        redis_mode: infoMap['redis_mode'] || 'standalone',
        uptime_in_seconds: parseInt(infoMap['uptime_in_seconds'] || '0', 10),
        total_keys: totalKeys,
        memory: {
          used_memory_human: infoMap['used_memory_human'] || '0B',
          used_memory_bytes: memoryUsageBytes,
          maxmemory_human: maxMemoryBytes === 0 ? 'no limit' : infoMap['maxmemory_human'] || '0B',
          maxmemory_bytes: maxMemoryBytes,
          mem_fragmentation_ratio: parseFloat(infoMap['mem_fragmentation_ratio'] || '0'),
        },
        stats: {
          keyspace_hits: hits,
          keyspace_misses: misses,
          hit_rate: hitRate,
          evicted_keys: parseInt(infoMap['evicted_keys'] || '0', 10),
          expired_keys: parseInt(infoMap['expired_keys'] || '0', 10),
          total_commands_processed: parseInt(infoMap['total_commands_processed'] || '0', 10),
          connected_clients: parseInt(infoMap['connected_clients'] || '0', 10),
        },
        replication: {
          role: infoMap['role'] || 'unknown',
          connected_slaves: parseInt(infoMap['connected_slaves'] || '0', 10),
        },
        recommendation: maxMemoryBytes === 0
          ? '⚠️  maxmemory belum dikonfigurasi. Untuk VPS 1GB, rekomendasikan: maxmemory 128mb + maxmemory-policy allkeys-lru'
          : '✅ maxmemory sudah dikonfigurasi.',
      },
    });
  } catch (err) {
    logger.error(`[CacheController] getStatus error: ${err.message}`);
    next(err);
  }
};

/**
 * POST /admin/cache/clear
 * Menghapus SEMUA cache key dari Redis DB saat ini (FLUSHDB).
 */
exports.clearAll = async (req, res, next) => {
  try {
    const success = await clearAll();

    if (!success) {
      return res.status(503).json({
        status: false,
        message: 'Redis tidak tersedia. Cache tidak bisa dibersihkan.',
      });
    }

    logger.info(`[CacheController] clearAll executed by user: ${req.user?.email || 'unknown'}`);

    return res.status(200).json({
      status: true,
      message: 'Semua cache berhasil dibersihkan.',
    });
  } catch (err) {
    logger.error(`[CacheController] clearAll error: ${err.message}`);
    next(err);
  }
};

/**
 * POST /admin/cache/clear/:pattern
 * Menghapus cache key yang cocok dengan pattern tertentu.
 * Contoh: POST /admin/cache/clear/exam:* → hapus semua cache dengan prefix "exam:"
 */
exports.clearByPatternHandler = async (req, res, next) => {
  try {
    const { pattern } = req.params;

    if (!pattern) {
      return res.status(400).json({
        status: false,
        message: 'Pattern tidak boleh kosong.',
      });
    }

    // Keamanan: larang pattern terlalu broad seperti "*" saja
    if (pattern.trim() === '*') {
      return res.status(400).json({
        status: false,
        message: 'Pattern "*" tidak diizinkan. Gunakan POST /admin/cache/clear untuk clear semua.',
      });
    }

    const deletedCount = await clearByPattern(pattern);

    logger.info(`[CacheController] clearByPattern pattern="${pattern}" deleted=${deletedCount} by user: ${req.user?.email || 'unknown'}`);

    return res.status(200).json({
      status: true,
      message: `Cache berhasil dibersihkan untuk pattern "${pattern}".`,
      data: { pattern, deleted_keys: deletedCount },
    });
  } catch (err) {
    logger.error(`[CacheController] clearByPattern error: ${err.message}`);
    next(err);
  }
};
