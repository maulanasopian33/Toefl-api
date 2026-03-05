// tests/cacheService.test.js
// Unit test untuk services/cache.service.js
// Menggunakan mock ioredis agar tidak butuh koneksi Redis sungguhan

jest.mock('../config/redis', () => {
  const mockClient = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
    flushdb: jest.fn(),
    ttl: jest.fn(),
    status: 'ready',
  };
  return {
    client: mockClient,
    isRedisReady: jest.fn(() => true),
  };
});

jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { client, isRedisReady } = require('../config/redis');
const {
  getCache,
  setCache,
  deleteCache,
  clearByPattern,
  getCacheTTL,
  clearAll,
} = require('../services/cache.service');

describe('Cache Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isRedisReady.mockReturnValue(true);
  });

  // ========== getCache ==========
  describe('getCache()', () => {
    test('[SUCCESS] mengembalikan data yang sudah di-parse dari Redis', async () => {
      const mockData = { id: 1, name: 'test' };
      client.get.mockResolvedValue(JSON.stringify(mockData));

      const result = await getCache('test:key');

      expect(client.get).toHaveBeenCalledWith('test:key');
      expect(result).toEqual(mockData);
    });

    test('[MISS] mengembalikan null jika key tidak ada di Redis', async () => {
      client.get.mockResolvedValue(null);

      const result = await getCache('test:missing');

      expect(result).toBeNull();
    });

    test('[FALLBACK] mengembalikan null jika Redis melempar error (graceful fallback)', async () => {
      client.get.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await getCache('test:error');

      expect(result).toBeNull();
    });

    test('[OFFLINE] mengembalikan null jika Redis tidak ready', async () => {
      isRedisReady.mockReturnValue(false);

      const result = await getCache('test:offline');

      expect(client.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  // ========== setCache ==========
  describe('setCache()', () => {
    test('[SUCCESS] memanggil setex dengan key, TTL, dan nilai JSON', async () => {
      client.setex.mockResolvedValue('OK');
      const value = { status: true, data: [1, 2, 3] };

      const result = await setCache('settings:global', value, 300);

      expect(client.setex).toHaveBeenCalledWith(
        'settings:global',
        300,
        JSON.stringify(value)
      );
      expect(result).toBe(true);
    });

    test('[SIZE GUARD] melewati penyimpanan jika value lebih dari 512KB', async () => {
      // Buat string besar lebih dari 512KB
      const bigValue = { data: 'X'.repeat(600 * 1024) };

      const result = await setCache('test:big', bigValue, 60);

      expect(client.setex).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    test('[FALLBACK] mengembalikan false jika Redis error', async () => {
      client.setex.mockRejectedValue(new Error('Redis error'));

      const result = await setCache('test:key', { data: 'ok' }, 60);

      expect(result).toBe(false);
    });

    test('[OFFLINE] mengembalikan false jika Redis tidak ready', async () => {
      isRedisReady.mockReturnValue(false);

      const result = await setCache('test:key', { ok: true }, 60);

      expect(client.setex).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  // ========== deleteCache ==========
  describe('deleteCache()', () => {
    test('[SUCCESS] memanggil del dan mengembalikan true jika key dihapus', async () => {
      client.del.mockResolvedValue(1);

      const result = await deleteCache('settings:global');

      expect(client.del).toHaveBeenCalledWith('settings:global');
      expect(result).toBe(true);
    });

    test('[NOT FOUND] mengembalikan false jika key tidak ada', async () => {
      client.del.mockResolvedValue(0);

      const result = await deleteCache('settings:nonexistent');

      expect(result).toBe(false);
    });

    test('[FALLBACK] mengembalikan false jika Redis error', async () => {
      client.del.mockRejectedValue(new Error('Redis error'));

      const result = await deleteCache('test:key');

      expect(result).toBe(false);
    });
  });

  // ========== clearByPattern ==========
  describe('clearByPattern()', () => {
    test('[SUCCESS] melakukan SCAN dan DEL untuk semua key yang cocok dengan pattern', async () => {
      // SCAN return: cursor 0 artinya selesai
      client.scan
        .mockResolvedValueOnce(['0', ['batch:all:any:any', 'batch:all:OPEN:any']]);
      client.del.mockResolvedValue(2);

      const deletedCount = await clearByPattern('batch:all:*');

      expect(client.scan).toHaveBeenCalledWith('0', 'MATCH', 'batch:all:*', 'COUNT', 100);
      expect(client.del).toHaveBeenCalledWith('batch:all:any:any', 'batch:all:OPEN:any');
      expect(deletedCount).toBe(2);
    });

    test('[EMPTY] mengembalikan 0 jika tidak ada key yang cocok', async () => {
      client.scan.mockResolvedValueOnce(['0', []]);

      const deletedCount = await clearByPattern('nonexistent:*');

      expect(client.del).not.toHaveBeenCalled();
      expect(deletedCount).toBe(0);
    });

    test('[FALLBACK] mengembalikan 0 jika Redis error', async () => {
      client.scan.mockRejectedValue(new Error('Redis error'));

      const deletedCount = await clearByPattern('exam:*');

      expect(deletedCount).toBe(0);
    });
  });

  // ========== getCacheTTL ==========
  describe('getCacheTTL()', () => {
    test('[SUCCESS] mengembalikan sisa TTL dari key', async () => {
      client.ttl.mockResolvedValue(250);

      const ttl = await getCacheTTL('settings:global');

      expect(client.ttl).toHaveBeenCalledWith('settings:global');
      expect(ttl).toBe(250);
    });

    test('[NOT FOUND] mengembalikan -2 jika key tidak ada', async () => {
      client.ttl.mockResolvedValue(-2);

      const ttl = await getCacheTTL('nonexistent');

      expect(ttl).toBe(-2);
    });

    test('[OFFLINE] mengembalikan -2 jika Redis tidak ready', async () => {
      isRedisReady.mockReturnValue(false);

      const ttl = await getCacheTTL('settings:global');

      expect(ttl).toBe(-2);
    });
  });

  // ========== clearAll ==========
  describe('clearAll()', () => {
    test('[SUCCESS] memanggil flushdb dan mengembalikan true', async () => {
      client.flushdb.mockResolvedValue('OK');

      const result = await clearAll();

      expect(client.flushdb).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('[FALLBACK] mengembalikan false jika Redis error', async () => {
      client.flushdb.mockRejectedValue(new Error('Redis error'));

      const result = await clearAll();

      expect(result).toBe(false);
    });
  });
});
