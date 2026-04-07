const path = require('path');

const storage = {
  getRelativePath: (storedPath) => {
    if (!storedPath) return '';
    
    // Check if it's a full URL
    if (storedPath.startsWith('http://') || storedPath.startsWith('https://')) {
      try {
        const urlObj = new URL(storedPath);
        // urlObj.pathname will be like "/storage/certificates/file.pdf"
        return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
      } catch (e) {
        // Fallback for malformed URLs
        return storedPath;
      }
    }
    
    // Fallback if it's already a relative path starting with /
    return storedPath.startsWith('/') ? storedPath.slice(1) : storedPath;
  }
};

const testCases = [
  { input: 'https://cdn.lbaiuqi.com/storage/certificates/cert-123.pdf', expected: 'storage/certificates/cert-123.pdf' },
  { input: 'http://localhost:4000/uploads/image.png', expected: 'uploads/image.png' },
  { input: '/storage/certificates/cert-456.pdf', expected: 'storage/certificates/cert-456.pdf' },
  { input: 'storage/certificates/cert-789.pdf', expected: 'storage/certificates/cert-789.pdf' },
  { input: '', expected: '' },
  { input: null, expected: '' }
];

console.log('--- RUNNING TESTS ---');
testCases.forEach((tc, idx) => {
  const result = storage.getRelativePath(tc.input);
  const passed = result === tc.expected;
  console.log(`[Test ${idx + 1}] Input: ${tc.input} -> Result: ${result} (${passed ? 'PASSED' : 'FAILED'})`);
  if (!passed) {
    console.error(`Expected: ${tc.expected}`);
  }
});
