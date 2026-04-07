const { sequelize } = require('./models');

async function check() {
  try {
    const [results] = await sequelize.query("SELECT id, userId, section_scores FROM userresults WHERE section_scores IS NOT NULL ORDER BY id DESC LIMIT 20");
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
