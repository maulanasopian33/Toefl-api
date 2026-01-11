const ScoringService = require('../services/scoringService');
const { sequelize, scoringtable, scoringdetail } = require('../models');

describe('ScoringService', () => {
  beforeAll(async () => {
    // Sync DB (assuming SQLite or test DB is handles by sequelize config)
    // Note: If sync({force: true}) is too destructive, use a cleaner approach
    // but resultService.test.js did it, so I assume it's okay for test environment.
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  let createdTableId;

  test('should create a scoring table with details', async () => {
    const data = {
      name: 'TOEFL Test Table',
      description: 'Test description',
      details: [
        { section_category: 'listening', correct_count: 1, converted_score: 25 },
        { section_category: 'listening', correct_count: 2, converted_score: 26 },
        { section_category: 'structure', correct_count: 1, converted_score: 21 }
      ]
    };

    const table = await ScoringService.createTable(data);
    
    expect(table.name).toBe(data.name);
    expect(table.details).toHaveLength(3);
    expect(table.details[0].section_category).toBe('listening');
    
    createdTableId = table.id;
  });

  test('should get all scoring tables', async () => {
    const tables = await ScoringService.getAllTables();
    expect(tables.length).toBeGreaterThan(0);
    expect(tables[0].name).toBe('TOEFL Test Table');
  });

  test('should get table by id', async () => {
    const table = await ScoringService.getTableById(createdTableId);
    expect(table.id).toBe(createdTableId);
    expect(table.name).toBe('TOEFL Test Table');
  });

  test('should update a scoring table and sync details', async () => {
    const updateData = {
      name: 'Updated TOEFL Table',
      details: [
        { section_category: 'listening', correct_count: 1, converted_score: 30 },
        { section_category: 'reading', correct_count: 5, converted_score: 40 }
      ]
    };

    const updatedTable = await ScoringService.updateTable(createdTableId, updateData);
    
    expect(updatedTable.name).toBe(updateData.name);
    expect(updatedTable.details).toHaveLength(2);
    expect(updatedTable.details.find(d => d.section_category === 'listening').converted_score).toBe(30);
    expect(updatedTable.details.find(d => d.section_category === 'reading')).toBeDefined();
  });

  test('should delete a scoring table', async () => {
    const result = await ScoringService.deleteTable(createdTableId);
    expect(result).toBe(true);
    
    await expect(ScoringService.getTableById(createdTableId)).rejects.toThrow('Scoring table not found');
  });
});
