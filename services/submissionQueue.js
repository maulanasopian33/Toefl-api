const fastq = require('fastq');
const { calculateUserResult } = require('./resultService');
const { logger } = require('../utils/logger');
const db = require('../models');

/**
 * Worker function to process scoring jobs.
 */
async function scoringWorker(arg, cb) {
  const { userId, batchId } = arg;
  try {
    logger.info(`Starting background scoring for User: ${userId}, Batch: ${batchId}`);
    
    // Calculate and update the record status to COMPLETED
    const result = await calculateUserResult(userId, batchId);
    
    // Update status to COMPLETED explicitly
    await db.userresult.update(
      { status: 'COMPLETED' },
      { where: { userId, batchId } }
    );
    
    logger.info(`Background scoring completed for User: ${userId}`);
    cb(null, result);
  } catch (error) {
    logger.error(`Background scoring failed for User: ${userId}`, error);
    
    // Update status to FAILED
    await db.userresult.update(
      { status: 'FAILED' },
      { where: { userId, batchId } }
    ).catch(e => logger.error('Failed to update result status to FAILED', e));
    
    cb(error);
  }
}

// Create a queue with concurrency of 2 (conservative for Node.js event loop safety)
const queue = fastq(scoringWorker, 2);

/**
 * Push a new scoring job to the queue.
 */
const pushToQueue = (userId, batchId) => {
  queue.push({ userId, batchId }, (err, result) => {
    if (err) {
      logger.error('Queue processing error:', err);
    }
  });
};

/**
 * Reconciliation: On startup, find PENDING results and queue them.
 */
const reconcilePendingResults = async () => {
  try {
    const pending = await db.userresult.findAll({
      where: { status: 'PENDING' },
      attributes: ['userId', 'batchId']
    });

    if (pending.length > 0) {
      logger.info(`Reconciling ${pending.length} pending results...`);
      pending.forEach(res => pushToQueue(res.userId, res.batchId));
    }
  } catch (error) {
    logger.error('Reconciliation error:', error);
  }
};

module.exports = {
  pushToQueue,
  reconcilePendingResults
};
