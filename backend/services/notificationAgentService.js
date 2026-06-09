/**
 * notificationAgentService.js
 * Core logic for the notification agent — no req/res dependency.
 * Called by schedulerService on cron schedule.
 *
 * Two jobs:
 *  1. checkMissingTransactions() — hardcoded daily check (fast, cheap)
 *  2. runWeeklyReports()         — LLM ReAct agent loop per user
 */

const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mysql = require('mysql2/promise');
const db = require('../config/db');
const Notification = require('../model/notificationModel');
const { toolDeclarations, executeTool } = require('../utils/notificationAgentTools');
const { getNotificationAgentPrompt } = require('../utils/notificationAgentPrompt');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = 'gemini-2.5-flash';
const MAX_ITERATIONS = 10;
const WEEKLY_CONCURRENCY = 5;

/**
 * Creates a dedicated connection for advisory locking.
 * This is closed at the end to guarantee MySQL releases the lock,
 * and avoids reusing lock-tainted connections in the connection pool.
 */
const createLockConnection = async () => {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    ssl: process.env.DB_SSL === 'true' ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    } : null,
  });
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

const fmt = (d) => d.toISOString().slice(0, 10);

const getWeekBounds = () => {
  const now = new Date();
  // Monday of this week (VN: week starts Monday)
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek + 1);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(weekStart.getDate() - 1);

  return {
    today: fmt(now),
    weekStart: fmt(weekStart),
    weekEnd: fmt(weekEnd),
    prevWeekStart: fmt(prevWeekStart),
    prevWeekEnd: fmt(prevWeekEnd),
  };
};

// ─── Daily Alert (hardcoded — cheap, no AI needed) ───────────────────────────

/**
 * For each user with no transaction today → create MISSING_TRANSACTION notification.
 */
const checkMissingTransactions = async () => {
  let lockConn;
  try {
    lockConn = await createLockConnection();
    const [[{ lockResult }]] = await lockConn.execute(
      'SELECT GET_LOCK(?, 0) AS lockResult',
      ['fintra_cron_daily_alert']
    );

    if (lockResult !== 1) {
      console.log('[NotificationAgent] Daily check already running or locked on another VM/instance. Skipping.');
      await lockConn.end().catch(() => {});
      return;
    }

    console.log('[NotificationAgent] Daily check lock acquired. Running check...');
    const [users] = await db.execute('SELECT id FROM users');

    for (const user of users) {
      const userId = user.id;

      const alreadySent = await Notification.hasToday(userId, 'MISSING_TRANSACTION');
      if (alreadySent) continue;

      const [[{ txCount }]] = await db.execute(
        `SELECT COUNT(*) AS txCount
         FROM transactions
         WHERE user_id = ? AND DATE(transaction_date) = CURDATE()`,
        [userId]
      );

      if (Number(txCount) === 0) {
        await Notification.create(
          uuidv4(),
          userId,
          'MISSING_TRANSACTION',
          '💸 Bạn chưa ghi giao dịch hôm nay',
          'Hôm nay bạn chưa có giao dịch nào được ghi lại. Đừng quên cập nhật thu chi để theo dõi tài chính chính xác nhé!'
        );
      }
    }

    console.log('[NotificationAgent] Daily check completed.');
  } catch (err) {
    console.error('[NotificationAgent] Daily check error:', err.message);
  } finally {
    if (lockConn) {
      try {
        await lockConn.execute('SELECT RELEASE_LOCK(?)', ['fintra_cron_daily_alert']);
      } catch (releaseErr) {
        console.error('[NotificationAgent] Failed to release daily check lock:', releaseErr.message);
      }
      await lockConn.end().catch(() => {});
    }
  }
};

// ─── Weekly Report — LLM ReAct Agent Loop ────────────────────────────────────

/**
 * Run the financial advisor agent loop for a single user.
 * The LLM autonomously decides what to query and what to notify.
 */
const runFinancialAdvisorLoop = async (userId) => {
  // Skip if weekly report already sent today (prevents double-run on scheduler restart)
  const alreadySent = await Notification.hasToday(userId, 'WEEKLY_REPORT');
  if (alreadySent) return;

  const { today, weekStart, weekEnd, prevWeekStart, prevWeekEnd } = getWeekBounds();

  const systemPrompt = getNotificationAgentPrompt(
    userId, today, weekStart, weekEnd, prevWeekStart, prevWeekEnd
  );

  const model = genAI.getGenerativeModel({
    model: MODEL,
    tools: [{ functionDeclarations: toolDeclarations }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    systemInstruction: systemPrompt,
  });

  console.log(`[NotificationAgent] Starting agent loop for user ${userId.slice(0, 8)}...`);
  // Stateless — no history. Agent starts fresh each week.
  const chat = model.startChat({ history: [] });

  // Kick off the agent with a single trigger message
  console.log(`[NotificationAgent] Sending initial prompt to agent...`);
  let result = await chat.sendMessage(
    'Bắt đầu phân tích tài chính tuần này. Thực hiện theo đúng 3 bước trong hướng dẫn.'
  );

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`[NotificationAgent] Iteration ${i + 1}...`);
    console.log(`[NotificationAgent] Raw Response JSON:`, JSON.stringify(result.response, null, 2));
    const functionCalls = result.response.functionCalls();

    // No more tool calls → agent finished
    if (!functionCalls || functionCalls.length === 0) {
      console.log(`[NotificationAgent] No function calls returned. Response text:`, result.response.text());
      break;
    }

    console.log(`[NotificationAgent] Agent requested ${functionCalls.length} tool calls:`, functionCalls.map(c => c.name));
    const toolResponseParts = [];
    for (const call of functionCalls) {
      console.log(`[NotificationAgent] Executing tool "${call.name}"...`);
      if (call.name === 'query_database') {
        console.log(`[NotificationAgent] SQL: ${call.args.sql}`);
      } else {
        console.log(`[NotificationAgent] Args:`, JSON.stringify(call.args));
      }
      
      const observation = await executeTool(call.name, call.args, userId);
      
      console.log(`[NotificationAgent] Observation output:`, JSON.stringify(observation).slice(0, 300));
      toolResponseParts.push({
        functionResponse: { name: call.name, response: observation },
      });
    }

    console.log(`[NotificationAgent] Sending observations to model...`);
    result = await chat.sendMessage(toolResponseParts);
  }

  console.log(`[NotificationAgent] Agent completed for user ${userId.slice(0, 8)}...`);
};

// ─── Weekly Reports — all users, concurrent batches ──────────────────────────

const runWeeklyReports = async () => {
  let lockConn;
  try {
    lockConn = await createLockConnection();
    const [[{ lockResult }]] = await lockConn.execute(
      'SELECT GET_LOCK(?, 0) AS lockResult',
      ['fintra_cron_weekly_report']
    );

    if (lockResult !== 1) {
      console.log('[NotificationAgent] Weekly reports already running or locked on another VM/instance. Skipping.');
      await lockConn.end().catch(() => {});
      return;
    }

    console.log('[NotificationAgent] Weekly reports lock acquired. Running reports...');
    const [users] = await db.execute('SELECT id FROM users');

    // Process in batches of WEEKLY_CONCURRENCY to avoid overwhelming DB + Gemini API
    for (let i = 0; i < users.length; i += WEEKLY_CONCURRENCY) {
      const batch = users.slice(i, i + WEEKLY_CONCURRENCY);
      await Promise.allSettled(
        batch.map(u => runFinancialAdvisorLoop(u.id).catch(err =>
          console.error(`[NotificationAgent] Failed for user ${u.id.slice(0, 8)}:`, err.message)
        ))
      );
    }

    console.log('[NotificationAgent] Weekly reports completed.');
  } catch (err) {
    console.error('[NotificationAgent] Weekly reports error:', err.message);
  } finally {
    if (lockConn) {
      try {
        await lockConn.execute('SELECT RELEASE_LOCK(?)', ['fintra_cron_weekly_report']);
      } catch (releaseErr) {
        console.error('[NotificationAgent] Failed to release weekly reports lock:', releaseErr.message);
      }
      await lockConn.end().catch(() => {});
    }
  }
};

module.exports = { checkMissingTransactions, runWeeklyReports, runFinancialAdvisorLoop };

