const { expect } = require('chai');
const sinon = require('sinon');
const resultController = require('../controllers/resultController');
const db = require('../models');

describe('Result Controller — candidates', () => {
  let findAndCountAllStub;
  let findOneStub;

  beforeEach(() => {
    findAndCountAllStub = sinon.stub(db.userresult, 'findAndCountAll');
    findOneStub = sinon.stub(db.userresult, 'findOne');
  });

  afterEach(() => {
    findAndCountAllStub.restore();
    findOneStub.restore();
  });

  it('should skip orphaned records without crashing', async () => {
    // Mock 1 valid result and 1 orphaned result
    findAndCountAllStub.resolves({
      count: 2,
      rows: [
        {
          id: 1,
          score: 500,
          submittedAt: new Date(),
          user: { uid: 'user-1', name: 'User 1', email: 'user1@example.com', detailuser: { nim: '123' } },
          batch: { idBatch: 'batch-1', name: 'Batch 1' }
        },
        {
          id: 44, // ORPHAN
          score: 400,
          submittedAt: new Date(),
          user: null, // This is what happens on orphaned records
          batch: { idBatch: 'batch-1', name: 'Batch 1' }
        }
      ]
    });

    findOneStub.resolves({
      get: (field) => field === 'avgScore' ? 450 : null
    });

    const req = { query: { page: 1, limit: 10 } };
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      set: sinon.stub().returnsThis()
    };
    const next = sinon.stub();

    await resultController.getCandidates(req, res, next);

    expect(res.status.calledWith(200)).to.be.true;
    const body = res.json.getCall(0).args[0];
    expect(body.data.length).to.equal(1); // Should only have the non-orphaned user
    expect(body.data[0].id).to.equal('res-1');
    expect(body.meta.summary.average_score).to.equal('450.00');
  });

  it('should handle zero results safely for average_score', async () => {
    findAndCountAllStub.resolves({ count: 0, rows: [] });
    findOneStub.resolves(null);

    const req = { query: { page: 1, limit: 10 } };
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      set: sinon.stub().returnsThis()
    };
    const next = sinon.stub();

    await resultController.getCandidates(req, res, next);

    expect(res.status.calledWith(200)).to.be.true;
    const body = res.json.getCall(0).args[0];
    expect(body.data.length).to.equal(0);
    expect(body.meta.summary.average_score).to.equal(0);
  });
});
