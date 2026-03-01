const batchController = require('./controllers/batchController');
const { batch } = require('./models');
const { v4: uuidv4 } = require('uuid');

async function debug() {
  const idBatch = uuidv4();
  try {
    console.log('--- SETUP: Creating Batch ---');
    await batch.create({
      idBatch,
      name: 'Debug Batch',
      scoring_type: 'RAW',
      scoring_config: { initialScore: 10 },
      status: 'DRAFT'
    });

    const req = {
      params: { idBatch },
      body: {
        name: 'Updated Debug Batch',
        scoring_type: 'RAW',
        scoring_config: { initialScore: "50" } // String from frontend
      }
    };

    const res = {
      status: function(s) { this.statusCode = s; return this; },
      json: function(j) { this.data = j; return this; }
    };

    console.log('--- TEST: updateBatch with Object ---');
    await batchController.updateBatch(req, res);
    console.log('Response status:', res.statusCode);
    const resultConfig = res.data.data.scoring_config;
    console.log('Response data scoring_config:', resultConfig);
    console.log('Type of config:', typeof resultConfig);

    if (resultConfig && resultConfig.initialScore === 50) {
      console.log('SUCCESS: initialScore is 50 (number)');
    } else if (typeof resultConfig === 'string') {
      const parsed = JSON.parse(resultConfig);
      if (parsed.initialScore === 50) {
        console.log('PARTIAL SUCCESS: saved correctly but returned as string');
      } else {
        console.log('FAILURE: parsed string has wrong value');
      }
    } else {
      console.log('FAILURE: initialScore is', resultConfig?.initialScore);
    }

    console.log('--- TEST: updateBatch with Stringified JSON ---');
    const req2 = {
      params: { idBatch },
      body: {
        scoring_config: JSON.stringify({ initialScore: 75 })
      }
    };
    await batchController.updateBatch(req2, res);
    console.log('Response data scoring_config:', res.data.data.scoring_config);

    // CLEANUP
    await batch.destroy({ where: { idBatch }, force: true });
    console.log('--- CLEANUP DONE ---');

  } catch (err) {
    console.error('Debug Error:', err);
  } finally {
    process.exit();
  }
}

debug();
