// tests/cacheMiddleware.test.js
// Unit test untuk middlewares/cache.middleware.js
// Menggunakan mock cache.service dan node-mocks-http

jest.mock('../services/cache.service', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const httpMocks = require('node-mocks-http');
const { cacheMiddleware, cacheMiddlewareDynamic } = require('../middlewares/cache.middleware');
const { getCache, setCache } = require('../services/cache.service');

describe('Cache Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========== cacheMiddleware ==========
  describe('cacheMiddleware(key, ttl)', () => {
    test('[HIT] mengembalikan data dari cache langsung dengan header X-Cache: HIT', async () => {
      const cachedResponse = { status: true, data: { id: 1 } };
      getCache.mockResolvedValue(cachedResponse);

      const req = httpMocks.createRequest({ method: 'GET', url: '/settings' });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = cacheMiddleware('settings:global', 300);
      await middleware(req, res, next);

      expect(getCache).toHaveBeenCalledWith('settings:global');
      expect(next).not.toHaveBeenCalled(); // tidak teruskan ke controller
      expect(res.getHeader('X-Cache')).toBe('HIT');
      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData).toEqual(cachedResponse);
    });

    test('[MISS] memanggil next() dan menyimpan response ke cache setelah controller selesai', async () => {
      getCache.mockResolvedValue(null); // Cache MISS
      setCache.mockResolvedValue(true);

      const req = httpMocks.createRequest({ method: 'GET', url: '/settings' });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = cacheMiddleware('settings:global', 300);
      await middleware(req, res, next);

      // next() harus dipanggil karena cache miss
      expect(next).toHaveBeenCalled();

      // Simulasikan controller memanggil res.json()
      await res.json({ status: true, data: { id: 1 } });

      // setCache harus dipanggil untuk menyimpan ke cache
      expect(setCache).toHaveBeenCalledWith(
        'settings:global',
        { status: true, data: { id: 1 } },
        300
      );
      expect(res.getHeader('X-Cache')).toBe('MISS');
    });

    test('[FALLBACK] tetap memanggil next() meskipun Redis error (graceful)', async () => {
      getCache.mockRejectedValue(new Error('Redis connection refused'));

      const req = httpMocks.createRequest({ method: 'GET', url: '/settings' });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = cacheMiddleware('settings:global', 300);
      await middleware(req, res, next);

      // Harus tetap lanjut ke controller
      expect(next).toHaveBeenCalled();
    });

    test('[NO CACHE] tidak menyimpan ke cache jika status response bukan 2xx', async () => {
      getCache.mockResolvedValue(null);
      setCache.mockResolvedValue(true);

      const req = httpMocks.createRequest({ method: 'GET', url: '/settings' });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = cacheMiddleware('settings:global', 300);
      await middleware(req, res, next);

      // Simulasikan controller error (status 500)
      res.statusCode = 500;
      await res.json({ status: false, message: 'Internal Server Error' });

      expect(setCache).not.toHaveBeenCalled();
    });
  });

  // ========== cacheMiddlewareDynamic ==========
  describe('cacheMiddlewareDynamic(keyFn, ttl)', () => {
    test('[HIT] menggunakan dynamic key dari request params', async () => {
      const cachedResponse = { status: true, data: { id: 5 } };
      getCache.mockResolvedValue(cachedResponse);

      const req = httpMocks.createRequest({ method: 'GET', params: { id: '5' } });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = cacheMiddlewareDynamic((req) => `scoring:detail:${req.params.id}`, 300);
      await middleware(req, res, next);

      expect(getCache).toHaveBeenCalledWith('scoring:detail:5');
      expect(next).not.toHaveBeenCalled();
      expect(res.getHeader('X-Cache')).toBe('HIT');
    });

    test('[MISS] memanggil next() dan menyimpan response dengan dynamic key', async () => {
      getCache.mockResolvedValue(null);
      setCache.mockResolvedValue(true);

      const req = httpMocks.createRequest({ method: 'GET', params: { id: '5' } });
      const res = httpMocks.createResponse();
      const next = jest.fn();

      const middleware = cacheMiddlewareDynamic((req) => `scoring:detail:${req.params.id}`, 300);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      await res.json({ status: true, data: { id: 5 } });

      expect(setCache).toHaveBeenCalledWith(
        'scoring:detail:5',
        { status: true, data: { id: 5 } },
        300
      );
    });
  });
});
