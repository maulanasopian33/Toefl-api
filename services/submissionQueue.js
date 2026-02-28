const fastq = require('fastq');
const { calculateUserResult } = require('./resultService');
const { logger } = require('../utils/logger');
const db = require('../models');

/**
 * Worker function to process scoring jobs.
 */
async function scoringWorker(arg, cb) {
  const { userId, batchId, resultId } = arg;
  try {
    logger.info(`Starting background scoring for User: ${userId}, Batch: ${batchId}, Result: ${resultId}`);
    
    // Calculate and update the record status to COMPLETED
    const result = await calculateUserResult(userId, batchId, resultId);
    
    // Update status to COMPLETED explicitly for this specific result
    await db.userresult.update(
      { status: 'COMPLETED' },
      { where: { id: resultId } }
    );
    
    logger.info(`Background scoring completed for Result ID: ${resultId}`);
    cb(null, result);
  } catch (error) {
    logger.error(`Background scoring failed for Result ID: ${resultId}`, error);
    
    // Update status to FAILED
    await db.userresult.update(
      { status: 'FAILED' },
      { where: { id: resultId } }
    ).catch(e => logger.error('Failed to update result status to FAILED', e));
    
    cb(error);
  }
}

// Create a queue with concurrency of 2 (conservative for Node.js event loop safety)
const queue = fastq(scoringWorker, 2);

/**
 * Push a new scoring job to the queue.
 */
const pushToQueue = (userId, batchId, resultId) => {
  queue.push({ userId, batchId, resultId }, (err, result) => {
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
      attributes: ['id', 'userId', 'batchId']
    });

    if (pending.length > 0) {
      logger.info(`Reconciling ${pending.length} pending results...`);
      pending.forEach(res => pushToQueue(res.userId, res.batchId, res.id));
    }
  } catch (error) {
    logger.error('Reconciliation error:', error);
  }
};

module.exports = {
  pushToQueue,
  reconcilePendingResults
};
