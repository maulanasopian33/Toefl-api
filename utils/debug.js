const db = require('../models');
const { Op } = require('sequelize');
const { logger } = require('./logger');

/**
 * Log a debug message to the database.
 * @param {string} message - The debug message.
 * @param {object} [context] - Additional context/data (JSON).
 * @param {string} [level] - Log level: INFO, DEBUG, WARN, ERROR.
 * @param {string} [source] - Log source: FE, BE.
 * @param {string} [userId] - The user UID associated with this log.
 */
const debugLog = async (message, context = null, level = 'DEBUG', source = 'BE', userId = null) => {
  try {
    await db.debuglog.create({
      message,
      context,
      level,
      source,
      userId
    });
  } catch (error) {
    // Fallback to standard logger if DB write fails
    logger.error(`Failed to write debug log to DB: ${error.message}`);
    console.error(`[DEBUG_FALLBACK] ${level} - ${message}`, context);
  }
};

/**
 * Cleanup debug logs older than 24 hours.
 */
const cleanupDebugLogs = async () => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deletedCount = await db.debuglog.destroy({
      where: {
        createdAt: {
          [Op.lt]: yesterday
        }
      }
    });
    if (deletedCount > 0) {
      logger.info(`Cleanup: Deleted ${deletedCount} old debug logs.`);
    }
  } catch (error) {
    logger.error(`Failed to cleanup debug logs: ${error.message}`);
  }
};

// Run initial cleanup on startup after a short delay
setTimeout(cleanupDebugLogs, 5000);

// Start periodic cleanup (every 1 hour)
setInterval(cleanupDebugLogs, 60 * 60 * 1000);

module.exports = {
  debugLog,
  cleanupDebugLogs
};
