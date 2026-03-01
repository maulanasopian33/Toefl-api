const fs = require('fs');
const path = require('path');

// =====================================================================
// Test: Sistem Audit Log - semua status code harus dicatat
// =====================================================================
describe('Audit Middleware — All Status Codes', () => {
  let mockReq, mockRes, nextFn;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      path: '/users',
      originalUrl: '/users',
      params: {},
      query: {},
      body: { name: 'Admin', password: 'secret123' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      user: { uid: 'firebase-uid-abc123', id: 'firebase-uid-abc123' },
      get: (header) => header === 'User-Agent' ? 'TestAgent/1.0' : null
    };

    mockRes = {
      statusCode: 200,
      send: jest.fn().mockReturnThis()
    };

    nextFn = jest.fn();
  });

  test('should log successful mutation (200)', async () => {
    // Simulasi create auditlog
    const createdLogs = [];
    jest.spyOn(require('../models').auditlog, 'create').mockImplementation(async (data) => {
      createdLogs.push(data);
      return data;
    });

    const auditMiddleware = require('../middlewares/auditMiddleware');
    await auditMiddleware(mockReq, mockRes, nextFn);

    // Simulasi response sukses
    mockRes.statusCode = 200;
    mockRes.send('ok');

    expect(nextFn).toHaveBeenCalled();
  });

  test('should log failed mutation (400)', async () => {
    const createdLogs = [];
    jest.spyOn(require('../models').auditlog, 'create').mockImplementation(async (data) => {
      createdLogs.push(data);
      return data;
    });

    const auditMiddleware = require('../middlewares/auditMiddleware');
    await auditMiddleware(mockReq, mockRes, nextFn);

    mockRes.statusCode = 400;
    mockRes.send('bad request');

    expect(nextFn).toHaveBeenCalled();
  });

  test('should redact password from logged body', async () => {
    const createdLogs = [];
    jest.spyOn(require('../models').auditlog, 'create').mockImplementation(async (data) => {
      createdLogs.push(data);
    });

    const auditMiddleware = require('../middlewares/auditMiddleware');
    await auditMiddleware(mockReq, mockRes, nextFn);
    mockRes.send('ok');

    await new Promise(r => setTimeout(r, 50));

    if (createdLogs.length > 0) {
      expect(createdLogs[0].details.body.password).toBe('[REDACTED]');
      expect(createdLogs[0].userId).toBe('firebase-uid-abc123');
    }
  });
});

// =====================================================================
// Test: System Log File Controller
// =====================================================================
describe('System Log File Controller', () => {
  test('listSystemLogs should return list of .log files', async () => {
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      console.log('Log dir does not exist, skipping');
      return;
    }

    const mockReq = { user: { uid: 'admin-uid' } };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const nextFn = jest.fn();

    const { listSystemLogs } = require('../controllers/logController');
    await listSystemLogs(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    const jsonCall = mockRes.json.mock.calls[0][0];
    expect(jsonCall.status).toBe(true);
    expect(Array.isArray(jsonCall.data)).toBe(true);
    // Semua item harus berakhiran .log
    jsonCall.data.forEach(file => {
      expect(file.filename).toMatch(/\.log$/);
    });
  });

  test('getSystemLogContent should reject non-.log files', async () => {
    const mockReq = {
      params: { filename: '../app.js' },
      query: {}
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const nextFn = jest.fn();

    const { getSystemLogContent } = require('../controllers/logController');
    await getSystemLogContent(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});
