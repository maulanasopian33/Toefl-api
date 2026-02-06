/**
 * Verification Script for Scoring Logic
 * This script inserts test data into the existing database and verifies the scoring calculation.
 */
const db = require('./models');
const { calculateUserResult } = require('./services/resultService');
const { logger } = require('./utils/logger');

async function verifyScoring() {
  console.log('--- Starting Scoring Verification ---');
  
  try {
    // Disable FK checks for testing string-based categories
    await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    // 1. Setup Test Data
    const testUserId = 'test-user-' + Date.now();
    const testBatchId = 'test-batch-' + Date.now();
    
    console.log(`Using Test User: ${testUserId}, Batch: ${testBatchId}`);
    
    // Create User
    await db.user.create({
      uid: testUserId,
      name: 'Test Scoring User',
      email: testUserId + '@example.com',
      role: 'STUDENT',
      lastLogin: new Date()
    });
    
    // Create Batch (SCALE type)
    const batchData = await db.batch.create({
      idBatch: testBatchId,
      name: 'Test Scoring Batch',
      scoring_type: 'SCALE',
      status: 'RUNNING',
      start_date: new Date()
    });
    
    // Create a Default Scoring Table
    const defaultTable = await db.scoringtable.create({
      name: 'Default TOEFL Table',
      is_default: true
    });

    // Add conversion details to the default table using 'structure' category
    await db.scoringdetail.bulkCreate([
      { scoring_table_id: defaultTable.id, section_category: 'structure', correct_count: 1, converted_score: 25 },
      { scoring_table_id: defaultTable.id, section_category: 'structure', correct_count: 2, converted_score: 30 },
      { scoring_table_id: defaultTable.id, section_category: 'structure', correct_count: 3, converted_score: 35 }
    ]);

    // Create Section (without explicit tableId to trigger fallback to is_default)
    const section = await db.section.create({
      idSection: 'sec-' + Date.now(),
      namaSection: 'Structure Section', // contains 'structure', so fallbackCategory is 'structure'
      batchId: testBatchId,
      urutan: 1
    });
    
    // Create Group
    const group = await db.group.create({
      idGroup: 'grp-' + Date.now(),
      sectionId: section.idSection,
      batchId: testBatchId
    });
    
    // Create 3 Questions
    const q1 = await db.question.create({
      idQuestion: 'q1-' + Date.now(),
      text: 'Question 1',
      groupId: group.idGroup
    });
    const q2 = await db.question.create({
      idQuestion: 'q2-' + Date.now(),
      text: 'Question 2',
      groupId: group.idGroup
    });
    const q3 = await db.question.create({
      idQuestion: 'q3-' + Date.now(),
      text: 'Question 3',
      groupId: group.idGroup
    });
    
    // Create Options (Correct and Incorrect)
    const op1c = await db.option.create({ idOption: 'op1c-' + Date.now(), questionId: q1.idQuestion, text: 'A', isCorrect: true });
    const op1i = await db.option.create({ idOption: 'op1i-' + Date.now(), questionId: q1.idQuestion, text: 'B', isCorrect: false });
    
    const op2c = await db.option.create({ idOption: 'op2c-' + Date.now(), questionId: q2.idQuestion, text: 'A', isCorrect: true });
    
    const op3c = await db.option.create({ idOption: 'op3c-' + Date.now(), questionId: q3.idQuestion, text: 'A', isCorrect: true });
    const op3i = await db.option.create({ idOption: 'op3i-' + Date.now(), questionId: q3.idQuestion, text: 'B', isCorrect: false });
    
    // 2. Submit Answers (User answers 2 correctly, 1 incorrectly)
    await db.useranswer.bulkCreate([
      { userId: testUserId, batchId: testBatchId, sectionId: section.idSection, questionId: q1.idQuestion, optionId: op1c.idOption }, // Correct
      { userId: testUserId, batchId: testBatchId, sectionId: section.idSection, questionId: q2.idQuestion, optionId: op2c.idOption }, // Correct
      { userId: testUserId, batchId: testBatchId, sectionId: section.idSection, questionId: q3.idQuestion, optionId: op3i.idOption } // Incorrect
    ]);
    
    console.log('Test data inserted successfully.');
    
    // 3. Calculate Result
    const result = await calculateUserResult(testUserId, testBatchId);
    
    console.log('Calculation Result:', JSON.stringify(result, null, 2));
    
    // 4. Assertion
    // For 2 correct answers in Structure Fallback:
    // DEFAULT_CONVERSION_TABLES.structure[2-1] = 20
    // (20 * 10) / 3 = ~67
    
    if (result.correctCount === 2 && result.score > 0) {
      console.log('✅ VERIFICATION SUCCESS: Correct count and Score calculated.');
    } else {
      console.log('❌ VERIFICATION FAILED: Unexpected results.');
    }
    
    // Cleanup (optional, but good for cleanliness)
    // await db.useranswer.destroy({ where: { batchId: testBatchId } });
    // await db.question.destroy({ where: { groupId: group.idGroup } });
    // ... etc
    
  } catch (err) {
    console.error('❌ Verification Error:', err);
  } finally {
    process.exit();
  }
}

verifyScoring();
