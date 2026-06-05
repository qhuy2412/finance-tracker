/**
 * schedulerService.js
 * Registers cron jobs for the notification agent using node-cron.
 * Schedule is configured via .env:
 *   DAILY_ALERT_HOUR=21       (0-23, VN time)
 *   WEEKLY_REPORT_DAY=0       (0=Sunday, 1=Monday … 6=Saturday)
 *   WEEKLY_REPORT_HOUR=20     (0-23, VN time)
 */

const cron = require('node-cron');
const { checkMissingTransactions, runWeeklyReports } = require('./notificationAgentService');

const buildDailyCron = () => {
  const hour = parseInt(process.env.DAILY_ALERT_HOUR, 10);
  if (isNaN(hour) || hour < 0 || hour > 23) {
    console.warn('[Scheduler] DAILY_ALERT_HOUR invalid or missing — defaulting to 21');
    return '0 21 * * *';
  }
  return `0 ${hour} * * *`;
};

const buildWeeklyCron = () => {
  const day  = parseInt(process.env.WEEKLY_REPORT_DAY,  10);
  const hour = parseInt(process.env.WEEKLY_REPORT_HOUR, 10);

  const validDay  = !isNaN(day)  && day  >= 0 && day  <= 6 ? day  : 0;
  const validHour = !isNaN(hour) && hour >= 0 && hour <= 23 ? hour : 20;

  if (isNaN(day) || isNaN(hour)) {
    console.warn('[Scheduler] WEEKLY_REPORT_DAY/HOUR invalid or missing — defaulting to Sunday 20:00');
  }

  return `0 ${validHour} * * ${validDay}`;
};

const initScheduler = () => {
  const dailyCron  = buildDailyCron();
  const weeklyCron = buildWeeklyCron();

  cron.schedule(dailyCron, checkMissingTransactions, {
    timezone: 'Asia/Ho_Chi_Minh',
  });

  cron.schedule(weeklyCron, runWeeklyReports, {
    timezone: 'Asia/Ho_Chi_Minh',
  });

  console.log(`[Scheduler] Jobs registered — daily: "${dailyCron}", weekly: "${weeklyCron}" (Asia/Ho_Chi_Minh)`);
};

module.exports = { initScheduler };
