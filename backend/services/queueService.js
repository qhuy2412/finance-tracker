const db = require('../config/db');

/**
 * Enqueues a new pending job into the job queue.
 * Utilizes the uq_job_type_date unique constraint to prevent duplicate same-day enqueues.
 * 
 * @param {string} jobType - Name of the job (e.g. 'db_backup', 'daily_alert', 'weekly_report')
 * @returns {Promise<boolean>} True if enqueued successfully, false if skipped or failed
 */
const enqueueJob = async (jobType) => {
  try {
    const [result] = await db.execute(
      `INSERT IGNORE INTO job_queue (job_type, status, run_at)
       VALUES (?, 'PENDING', NOW())`,
      [jobType]
    );
    if (result.affectedRows === 1) {
      console.log(`[Queue] Job "${jobType}" enqueued successfully.`);
      return true;
    } else {
      console.log(`[Queue] Job "${jobType}" for today already queued. Skipping.`);
      return false;
    }
  } catch (err) {
    console.error(`[Queue] Failed to enqueue job "${jobType}":`, err.message);
    return false;
  }
};

module.exports = { enqueueJob };
