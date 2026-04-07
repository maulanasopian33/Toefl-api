const storage = require('./utils/storage');

const testCases = [
  { input: 'https://cdn.lbaiuqi.com/storage/certificates/cert-123.pdf', expected: 'storage/certificates/cert-123.pdf' },
  { input: 'http://localhost:4000/uploads/image.png', expected: 'uploads/image.png' },
  { input: '/storage/certificates/cert-456.pdf', expected: 'storage/certificates/cert-456.pdf' },
  { input: 'storage/certificates/cert-789.pdf', expected: 'storage/certificates/cert-789.pdf' },
  { input: '', expected: '' },
  { input: null, expected: '' }
];

console.log('--- RUNNING INTEGRATION TESTS WITH ACTUAL storage.js ---');
testCases.forEach((tc, idx) => {
  const result = storage.getRelativePath(tc.input);
  const passed = result === tc.expected;
  console.log(`[Test ${idx + 1}] Input: ${tc.input} -> Result: ${result} (${passed ? 'PASSED' : 'FAILED'})`);
  if (!passed) {
    console.error(`Expected: ${tc.expected}`);
  }
});
