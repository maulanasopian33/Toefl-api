'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const batchId = 'seeder-batch-001'; // Hardcoded ID for easy identification and rollback

    // 1. Create a Batch
    await queryInterface.bulkInsert('batches', [{
      idBatch: batchId,
      name: 'TOEFL Intensive Preparation Batch 1',
      description: 'A comprehensive 4-week program designed to boost your TOEFL score. Includes live sessions, tryouts, and discussion groups.',
      type: 'FULL_PACKAGE',
      start_date: new Date('2025-02-01'),
      end_date: new Date('2025-03-01'),
      registration_open_at: new Date('2025-01-01'),
      registration_close_at: new Date('2025-01-31'),
      max_participants: 20,
      min_participants: 5,
      status: 'OPEN',
      price: 1500000,
      currency: 'IDR',
      duration_minutes: 2400, // 40 hours total
      special_instructions: 'Please ensure you have a stable internet connection for live sessions.',
      created_by: null, // Set to a valid user UID if foreign key constraints require it and user exists
      createdAt: new Date(),
      updatedAt: new Date()
    }]);

    // 2. Create Sessions linked to the Batch
    await queryInterface.bulkInsert('batchsessions', [
      {
        batch_id: batchId,
        title: 'Orientation & Diagnostic Test',
        session_type: 'CLASS',
        start_at: new Date('2025-02-01 09:00:00'),
        end_at: new Date('2025-02-01 11:00:00'),
        meeting_url: 'https://zoom.us/j/example1',
        trainer_id: null,
        capacity: 20,
        notes: 'Introduction to the course structure and initial assessment.',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        batch_id: batchId,
        title: 'Listening Comprehension: Strategies',
        session_type: 'CLASS',
        start_at: new Date('2025-02-03 19:00:00'),
        end_at: new Date('2025-02-03 21:00:00'),
        meeting_url: 'https://zoom.us/j/example2',
        trainer_id: null,
        capacity: 20,
        notes: 'Focus on Part A: Short Dialogues.',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        batch_id: batchId,
        title: 'Weekly Tryout 1',
        session_type: 'TRYOUT',
        start_at: new Date('2025-02-08 08:00:00'),
        end_at: new Date('2025-02-08 10:00:00'),
        meeting_url: null, // Online platform
        trainer_id: null,
        capacity: 20,
        notes: 'Full simulation of Listening and Structure sections.',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    const batchId = 'seeder-batch-001';
    
    // Delete sessions first
    await queryInterface.bulkDelete('batchsessions', { batch_id: batchId }, {});
    // Delete batch
    await queryInterface.bulkDelete('batches', { idBatch: batchId }, {});
  }
};