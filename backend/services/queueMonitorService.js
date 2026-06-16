const db = require('../config/db');
const { sendTelegramToAdmins } = require('../controller/telegramController');

const STUCK_JOB_TIMEOUT_HOURS = 2;
const RETENTION_DAYS = 30;

const runQueueMaintenance = async () => {
  try {
    // 1. Reset stuck RUNNING jobs
    const [stuckResult] = await db.execute(
      `UPDATE job_queue
       SET status = 'FAILED',
           error_message = 'Auto-reset: job exceeded ${STUCK_JOB_TIMEOUT_HOURS}h timeout',
           completed_at = NOW()
       WHERE status = 'RUNNING'
         AND started_at < NOW() - INTERVAL ${STUCK_JOB_TIMEOUT_HOURS} HOUR`
    );
    if (stuckResult.affectedRows > 0) {
      console.log(`[QueueMonitor] Reset ${stuckResult.affectedRows} stuck job(s) to FAILED.`);
    }

    // 2. Delete old rows
    const [cleanResult] = await db.execute(
      `DELETE FROM job_queue
       WHERE completed_at < NOW() - INTERVAL ${RETENTION_DAYS} DAY`
    );
    if (cleanResult.affectedRows > 0) {
      console.log(`[QueueMonitor] Deleted ${cleanResult.affectedRows} old job row(s).`);
    }

    // 3. Alert on new FAILED jobs
    const [failedJobs] = await db.execute(
      `SELECT id, job_type, error_message, completed_at
       FROM job_queue
       WHERE status = 'FAILED' AND notified = 0`
    );

    for (const job of failedJobs) {
      const msg =
        `🚨 *Backup thất bại*\n\n` +
        `Job: \`${job.job_type}\` (ID: ${job.id})\n` +
        `Thời gian: ${job.completed_at}\n` +
        `Lỗi: ${job.error_message || 'Không rõ'}\n\n` +
        `Kiểm tra bot-backup-db và thử lại thủ công nếu cần.`;

      await sendTelegramToAdmins(msg);

      await db.execute(
        `UPDATE job_queue SET notified = 1 WHERE id = ?`,
        [job.id]
      );
    }
  } catch (err) {
    console.error('[QueueMonitor] Maintenance error:', err.message);
  }
};

module.exports = { runQueueMaintenance };
