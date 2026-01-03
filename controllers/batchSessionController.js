const { batchsession, batch, user } = require('../models');

module.exports = {
  // Create a single session
  createSession: async (req, res) => {
    try {
      const {
        batch_id,
        title,
        session_type,
        start_at,
        end_at,
        meeting_url,
        trainer_id,
        capacity,
        notes
      } = req.body;

      // Validate batch existence
      const existingBatch = await batch.findByPk(batch_id);
      if (!existingBatch) {
        return res.status(404).json({
          status: false,
          message: 'Batch not found'
        });
      }

      const newSession = await batchsession.create({
        batch_id,
        title,
        session_type,
        start_at,
        end_at,
        meeting_url,
        trainer_id,
        capacity,
        notes
      });

      return res.status(201).json({
        status: true,
        message: 'Session created successfully',
        data: newSession
      });
    } catch (error) {
      console.error('Error creating session:', error);
      return res.status(500).json({
        status: false,
        message: 'Failed to create session',
        error: error.message
      });
    }
  },

  // Get all sessions for a specific batch
  getSessionsByBatch: async (req, res) => {
    try {
      const { batchId } = req.params;
      
      const sessions = await batchsession.findAll({
        where: { batch_id: batchId },
        include: [
          { model: user, as: 'trainer', attributes: ['uid', 'name', 'email'] }
        ],
        order: [['start_at', 'ASC']]
      });

      return res.status(200).json({
        status: true,
        data: sessions
      });
    } catch (error) {
      console.error('Error fetching sessions for batch:', error);
      return res.status(500).json({
        status: false,
        message: 'Failed to fetch sessions',
        error: error.message
      });
    }
  },

  // Get session details by ID
  getSessionById: async (req, res) => {
    try {
      const { id } = req.params;
      const session = await batchsession.findByPk(id, {
        include: [
          { model: batch, as: 'batch', attributes: ['idBatch', 'name'] },
          { model: user, as: 'trainer', attributes: ['uid', 'name', 'email'] }
        ]
      });

      if (!session) {
        return res.status(404).json({ status: false, message: 'Session not found' });
      }

      return res.status(200).json({ status: true, data: session });
    } catch (error) {
      return res.status(500).json({ status: false, message: 'Failed to fetch session', error: error.message });
    }
  },

  // Update a session
  updateSession: async (req, res) => {
    try {
      const { id } = req.params;
      const session = await batchsession.findByPk(id);

      if (!session) {
        return res.status(404).json({ status: false, message: 'Session not found' });
      }

      await session.update(req.body);

      return res.status(200).json({ status: true, message: 'Session updated successfully', data: session });
    } catch (error) {
      return res.status(500).json({ status: false, message: 'Failed to update session', error: error.message });
    }
  },

  // Delete a session
  deleteSession: async (req, res) => {
    try {
      const { id } = req.params;
      const session = await batchsession.findByPk(id);

      if (!session) {
        return res.status(404).json({ status: false, message: 'Session not found' });
      }

      await session.destroy();

      return res.status(200).json({ status: true, message: 'Session deleted successfully' });
    } catch (error) {
      return res.status(500).json({ status: false, message: 'Failed to delete session', error: error.message });
    }
  }
};