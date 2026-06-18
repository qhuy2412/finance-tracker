const db = require('../config/db');
const { checkMissingTransactions, runWeeklyReports } = require('./notificationAgentService');

const POLL_INTERVAL_MS = 15000; // Poll every 15 seconds

const WORKER_HANDLERS = {
  daily_alert:   checkMissingTransactions,
  weekly_report: runWeeklyReports,
};

const pollAndExecuteJobs = async () => {
  let connection;
  let jobId = null;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Lock and claim a pending job
    const [rows] = await connection.execute(
      `SELECT id, job_type FROM job_queue
       WHERE job_type IN ('daily_alert', 'weekly_report')
         AND status = 'PENDING'
         AND run_at <= NOW()
       LIMIT 1 FOR UPDATE SKIP LOCKED`
    );

    if (rows.length === 0) {
      await connection.commit();
      connection.release();
      connection = null;
      return;
    }

    const { id, job_type } = rows[0];
    jobId = id;

    // Update job to RUNNING
    await connection.execute(
      `UPDATE job_queue SET status = 'RUNNING', started_at = NOW() WHERE id = ?`,
      [jobId]
    );
    await connection.commit();
    connection.release();
    connection = null;

    console.log(`[QueueWorker] Claimed job "${job_type}" (ID: ${jobId}). Executing...`);

    const handler = WORKER_HANDLERS[job_type];
    if (!handler) {
      throw new Error(`No handler registered for job type "${job_type}"`);
    }

    // Run actual job logic
    await handler();

    // Mark job as COMPLETED
    await db.execute(
      `UPDATE job_queue SET status = 'COMPLETED', completed_at = NOW() WHERE id = ?`,
      [jobId]
    );
    console.log(`[QueueWorker] Job "${job_type}" (ID: ${jobId}) completed successfully.`);
  } catch (err) {
    console.error(`[QueueWorker] Job execution failed:`, err.message);
    if (jobId) {
      try {
        await db.execute(
          `UPDATE job_queue SET status = 'FAILED', error_message = ?, completed_at = NOW() WHERE id = ?`,
          [err.message, jobId]
        );
      } catch (dbErr) {
        console.error(`[QueueWorker] Failed to update job ${jobId} to FAILED:`, dbErr.message);
      }
    }
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
      } catch (_) {}
    }
  }
};

const startQueueWorker = () => {
  console.log('[QueueWorker] Starting FinTra background queue worker...');
  setInterval(pollAndExecuteJobs, POLL_INTERVAL_MS);
};

module.exports = { startQueueWorker };
