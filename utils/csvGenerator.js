/**
 * Utility to convert an array of objects to CSV format.
 * @param {Array<Object>} data - The data to convert.
 * @param {Array<string>} [headers] - Optional headers. If not provided, keys of the first object will be used.
 * @returns {string} - The CSV string.
 */
function jsonToCsv(data, headers) {
  if (!data || !data.length) return '';

  const columns = headers || Object.keys(data[0]);
  
  const csvRows = [];
  
  // Add header row
  csvRows.push(columns.join(','));

  // Add data rows
  for (const row of data) {
    const values = columns.map(header => {
      let val = row[header];
      if (val === null || val === undefined) val = '';
      
      // Escape double quotes and handle strings with commas
      let stringVal = String(val);
      if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
        stringVal = `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

module.exports = {
  jsonToCsv
};
