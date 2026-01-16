const crypto = require('crypto');

// Simulating the logic in examController.js for testing
function generateIdOption(questionId, index, optionText) {
  const hash = crypto.createHash('md5').update(optionText.trim()).digest('hex').substring(0, 8);
  return `opt-${questionId}-${index}-${hash}`;
}

describe('idOption Generation Logic', () => {
  test('should generate unique IDs for different options with same prefix', () => {
    const questionId = 'q1';
    const option1 = 'The quick brown fox';
    const option2 = 'The quick brown fox jumps';
    
    const id1 = generateIdOption(questionId, 0, option1);
    const id2 = generateIdOption(questionId, 1, option2);
    
    expect(id1).not.toBe(id2);
  });

  test('should be stable for same text', () => {
    const questionId = 'q1';
    const optionText = '   Some option text   ';
    
    const id1 = generateIdOption(questionId, 0, optionText);
    const id2 = generateIdOption(questionId, 0, 'Some option text');
    
    expect(id1).toBe(id2);
  });

  test('should differ by index even if text is same', () => {
    const questionId = 'q1';
    const optionText = 'Same text';
    
    const id1 = generateIdOption(questionId, 0, optionText);
    const id2 = generateIdOption(questionId, 1, optionText);
    
    expect(id1).not.toBe(id2);
  });
});
