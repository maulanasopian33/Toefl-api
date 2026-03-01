const db = require('../models');

describe('Database Migration Sync Verification', () => {
  test('Settings model should have payment instruction fields', async () => {
    const attributes = db.setting.rawAttributes;
    expect(attributes).toHaveProperty('payment_instructions_bank');
    expect(attributes).toHaveProperty('payment_instructions_offline');
    expect(attributes).toHaveProperty('payment_offline_details');
  });

  test('AuditLog model should exist and have correct userId type', async () => {
    const auditLogModel = db.auditlog;
    expect(auditLogModel).toBeDefined();
    const attributes = auditLogModel.rawAttributes;
    expect(attributes.userId.type.constructor.name).toBe('STRING');
    // FK constraint dihapus dari DB level untuk kompatibilitas Firebase UID (string PK)
    // relasi dijaga secara logis di model Sequelize
  });

  test('UserResult model should have status field', async () => {
    const attributes = db.userresult.rawAttributes;
    expect(attributes).toHaveProperty('status');
  });

  afterAll(async () => {
    await db.sequelize.close();
  });
});
