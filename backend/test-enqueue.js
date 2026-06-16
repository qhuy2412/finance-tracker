const { enqueueJob } = require('./services/queueService');
const db = require('./config/db');

(async () => {
  await enqueueJob('weekly_report');
  process.exit(0);
})();
