const { batch } = require('./models');
const { v4: uuidv4 } = require('uuid');

async function verify() {
  const idBatch = uuidv4();
  try {
    console.log('Creating test batch...');
    const newBatch = await batch.create({
      idBatch,
      name: 'Repro Test Scoring',
      scoring_type: 'RAW',
      scoring_config: { initialScore: 50 },
      status: 'DRAFT'
    });
    console.log('Created:', newBatch.toJSON().scoring_config);

    console.log('Updating test batch...');
    await batch.update({
      scoring_config: { initialScore: 75 }
    }, {
      where: { idBatch }
    });

    const updatedBatch = await batch.findByPk(idBatch);
    console.log('Updated:', updatedBatch.toJSON().scoring_config);

    if (updatedBatch.scoring_config.initialScore === 75) {
      console.log('SUCCESS: Scoring config saved correctly via model.');
    } else {
      console.log('FAILURE: Scoring config NOT saved correctly.');
    }

    // Clean up
    await newBatch.destroy({ force: true });
    console.log('Cleaned up.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

verify();
