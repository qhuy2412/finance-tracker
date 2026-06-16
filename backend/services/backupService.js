const db = require('../config/db');

const runDatabaseBackup = async () => {
  try {
    const [result] = await db.execute(
      `INSERT IGNORE INTO job_queue (job_type, status, run_at)
       VALUES ('db_backup', 'PENDING', NOW())`
    );
    if (result.affectedRows === 1) {
      console.log('[Backup] Job enqueued — bot-backup-db will execute it.');
    } else {
      console.log('[Backup] Backup job for today already queued. Skipping.');
    }
  } catch (err) {
    console.error('[Backup] Failed to enqueue backup job:', err.message);
  }
};

module.exports = { runDatabaseBackup };
