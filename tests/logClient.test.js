const logController = require('../controllers/logController');
const { logger } = require('../utils/logger');

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    log: jest.fn()
  }
}));

describe('logController.saveClientLog', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {
        level: 'error',
        message: 'Test client error',
        metadata: { screen: 'Dashboard' }
      },
      user: { uid: 'user-123' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('should successfully save a client log', async () => {
    await logController.saveClientLog(req, res, next);

    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      message: 'Test client error',
      source: 'frontend',
      userId: 'user-123',
      screen: 'Dashboard'
    }));

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: true,
      message: 'Client log saved successfully.'
    }));
  });

  test('should return 400 if message is missing', async () => {
    req.body.message = '';
    await logController.saveClientLog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: false,
      message: 'Log message is required.'
    }));
    expect(logger.log).not.toHaveBeenCalled();
  });

  test('should use default level "info" if not provided', async () => {
    delete req.body.level;
    await logController.saveClientLog(req, res, next);

    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      level: 'info'
    }));
  });

  test('should use "anonymous" if userId is missing', async () => {
    delete req.user;
    await logController.saveClientLog(req, res, next);

    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'anonymous'
    }));
  });
});
