/**
 * schedulerService.js
 * Manages background cron jobs with dynamic scheduling loaded from the database.
 *
 * - Cron expressions are stored in the `scheduler_settings` DB table (not .env).
 * - On startup, schedules are loaded from DB and registered in memory.
 * - On schedule change, a Redis Pub/Sub signal triggers all running instances
 *   to reload their in-memory cron jobs without a server restart.
 * - If Redis is unavailable, the scheduler runs in standalone mode (no cross-VM sync).
 */

const cron = require('node-cron');
const db = require('../config/db');
const { checkMissingTransactions, runWeeklyReports } = require('./notificationAgentService');
const { runDatabaseBackup } = require('./backupService');
const { runQueueMaintenance } = require('./queueMonitorService');

// ── State ─────────────────────────────────────────────────────────────────────

// Holds references to active ScheduledTask objects so we can stop/replace them.
const runningJobs = {};

// Redis clients — null when Redis is unavailable (degraded mode).
let redisPub = null;
let redisSub = null;

// Maps job_name (DB) → the actual async function to execute.
const JOB_HANDLERS = {
  daily_alert:   checkMissingTransactions,
  weekly_report: runWeeklyReports,
  db_backup:     runDatabaseBackup,
};

// ── Core Scheduling ───────────────────────────────────────────────────────────

/**
 * Loads cron expressions from DB and (re)registers all in-memory jobs.
 * Safe to call multiple times — stops previous jobs before creating new ones.
 */
const loadAndScheduleJobs = async () => {
  try {
    const [rows] = await db.execute('SELECT job_name, cron_expression FROM scheduler_settings');

    for (const { job_name, cron_expression } of rows) {
      // Stop existing job for this name before replacing it
      if (runningJobs[job_name]) {
        runningJobs[job_name].stop();
      }

      const handler = JOB_HANDLERS[job_name];
      if (!handler) {
        // Job exists in DB but has no handler yet (e.g. db_backup not wired up)
        continue;
      }

      runningJobs[job_name] = cron.schedule(cron_expression, handler, {
        timezone: 'Asia/Ho_Chi_Minh',
      });

      console.log(`[Scheduler] Job "${job_name}" scheduled: "${cron_expression}"`);
    }
  } catch (err) {
    console.error('[Scheduler] Failed to load jobs from database:', err.message);
  }
};

// ── Redis Pub/Sub Setup ────────────────────────────────────────────────────────

/**
 * Attempts to connect Redis Pub/Sub clients for cross-VM schedule sync.
 * Falls back to standalone mode (no sync) if Redis is unreachable.
 */
const initRedisSync = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[Scheduler] REDIS_URL not set — running without cross-VM sync.');
    return;
  }

  try {
    const Redis = require('ioredis');

    redisPub = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    redisSub = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });

    redisPub.on('error', (err) => console.error('[Scheduler] Redis Pub error:', err.message));
    redisSub.on('error', (err) => console.error('[Scheduler] Redis Sub error:', err.message));

    await redisPub.connect();
    await redisSub.connect();

    await redisSub.subscribe('scheduler_sync');
    redisSub.on('message', async (channel, message) => {
      if (channel === 'scheduler_sync' && message === 'reload') {
        console.log('[Scheduler] Reload signal received — refreshing cron jobs from DB.');
        await loadAndScheduleJobs();
      }
    });

    console.log('[Scheduler] Redis Pub/Sub sync initialized.');
  } catch (err) {
    console.error('[Scheduler] Redis unavailable — running without cross-VM sync:', err.message);
    redisPub = null;
    redisSub = null;
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Publishes a reload signal to all connected instances via Redis.
 * No-op if Redis is unavailable (standalone mode).
 */
const broadcastReload = async () => {
  if (redisPub) {
    await redisPub.publish('scheduler_sync', 'reload');
    console.log('[Scheduler] Reload signal broadcasted to all instances.');
  } else {
    // Redis not available — apply change locally only
    await loadAndScheduleJobs();
  }
};

// Run queue maintenance once at startup, then every hour.
const initQueueMonitor = () => {
  runQueueMaintenance();
  setInterval(runQueueMaintenance, 60 * 60 * 1000);
};

/**
 * Entrypoint called once on server startup.
 * Initialises Redis sync then loads all scheduled jobs from DB.
 */
const initScheduler = async () => {
  await initRedisSync();
  await loadAndScheduleJobs();
  initQueueMonitor();
};

module.exports = { initScheduler, broadcastReload };
