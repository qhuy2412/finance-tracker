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
const db = require('../config/db');
const Notification = require('../model/notificationModel');
const { toolDeclarations, executeTool } = require('../utils/notificationAgentTools');
const { getNotificationAgentPrompt } = require('../utils/notificationAgentPrompt');
const { logWeeklyReportActivity } = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = 'gemini-2.5-flash';
const MAX_ITERATIONS = 10;
const WEEKLY_CONCURRENCY = 5;


// ─── Date helpers ─────────────────────────────────────────────────────────────

const getWeekBounds = () => {
  const now = new Date();
  // Shift by 7 hours to get the timezone-independent UTC representations of VN time
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  
  const dayOfWeek = vnNow.getUTCDay() === 0 ? 7 : vnNow.getUTCDay();
  const weekStart = new Date(vnNow);
  weekStart.setUTCDate(vnNow.getUTCDate() - dayOfWeek + 1);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setUTCDate(weekStart.getUTCDate() - 1);

  return {
    today: vnNow.toISOString().slice(0, 10),
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    prevWeekStart: prevWeekStart.toISOString().slice(0, 10),
    prevWeekEnd: prevWeekEnd.toISOString().slice(0, 10),
  };
};

// ─── Daily Alert (hardcoded — cheap, no AI needed) ───────────────────────────

/**
 * For each user with no transaction today → create MISSING_TRANSACTION notification.
 */
const checkMissingTransactions = async () => {
  try {
    console.log('[NotificationAgent] Running daily check...');
    const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Optimized batch query: find all users who have no transaction logged today
    // and have not been sent a MISSING_TRANSACTION alert today.
    const [users] = await db.execute(
      `SELECT u.id
       FROM users u
       LEFT JOIN transactions t 
         ON u.id = t.user_id 
         AND t.transaction_date = ?
       LEFT JOIN notifications n 
         ON u.id = n.user_id 
         AND n.type = 'MISSING_TRANSACTION' 
         AND DATE(CONVERT_TZ(n.created_at, '+00:00', '+07:00')) = ?
       WHERE t.id IS NULL AND n.id IS NULL`,
      [todayStr, todayStr]
    );

    for (const user of users) {
      await Notification.create(
        uuidv4(),
        user.id,
        'MISSING_TRANSACTION',
        '💸 Bạn chưa ghi giao dịch hôm nay',
        'Hôm nay bạn chưa có giao dịch nào được ghi lại. Đừng quên cập nhật thu chi để theo dõi tài chính chính xác nhé!'
      );
    }

    console.log('[NotificationAgent] Daily check completed.');
  } catch (err) {
    console.error('[NotificationAgent] Daily check error:', err.message);
    throw err;
  }
};

// ─── Weekly Report — LLM ReAct Agent Loop ────────────────────────────────────

/**
 * Run the financial advisor agent loop for a single user.
 * The LLM autonomously decides what to query and what to notify.
 */
const runFinancialAdvisorLoop = async (userId) => {
  const { today, weekStart, weekEnd, prevWeekStart, prevWeekEnd } = getWeekBounds();

  // Skip if weekly report already sent today (prevents double-run on scheduler restart)
  const alreadySent = await Notification.hasToday(userId, 'WEEKLY_REPORT', today);
  if (alreadySent) return;

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

  const startTime = Date.now();
  let totalPromptTokens = 0;
  let totalCandidatesTokens = 0;
  const steps = [];

  // Kick off the agent with a single trigger message
  console.log(`[NotificationAgent] Sending initial prompt to agent...`);
  let result = await chat.sendMessage(
    'Bắt đầu phân tích tài chính tuần này. Thực hiện theo đúng 3 bước trong hướng dẫn.'
  );

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (result.response.usageMetadata) {
      totalPromptTokens = result.response.usageMetadata.promptTokenCount || totalPromptTokens;
      totalCandidatesTokens = result.response.usageMetadata.candidatesTokenCount || totalCandidatesTokens;
    }

    console.log(`[NotificationAgent] Iteration ${i + 1}...`);
    console.log(`[NotificationAgent] Raw Response JSON:`, JSON.stringify(result.response, null, 2));
    const functionCalls = result.response.functionCalls();

    // No more tool calls → agent finished
    if (!functionCalls || functionCalls.length === 0) {
      console.log(`[NotificationAgent] No function calls returned. Response text:`, result.response.text());
      break;
    }

    const currentStep = {
      iteration: i + 1,
      toolCalls: [],
      observations: []
    };

    console.log(`[NotificationAgent] Agent requested ${functionCalls.length} tool calls:`, functionCalls.map(c => c.name));
    const toolResponseParts = [];
    for (const call of functionCalls) {
      currentStep.toolCalls.push(call);

      console.log(`[NotificationAgent] Executing tool "${call.name}"...`);
      if (call.name === 'query_database') {
        console.log(`[NotificationAgent] SQL: ${call.args.sql}`);
      } else {
        console.log(`[NotificationAgent] Args:`, JSON.stringify(call.args));
      }
      
      const observation = await executeTool(call.name, call.args, userId);
      
      currentStep.observations.push({ toolName: call.name, result: observation });

      console.log(`[NotificationAgent] Observation output:`, JSON.stringify(observation).slice(0, 300));
      toolResponseParts.push({
        functionResponse: { name: call.name, response: observation },
      });
    }

    steps.push(currentStep);

    console.log(`[NotificationAgent] Sending observations to model...`);
    result = await chat.sendMessage(toolResponseParts);
  }

  // Capture final tokens
  if (result.response.usageMetadata) {
    totalPromptTokens = result.response.usageMetadata.promptTokenCount || totalPromptTokens;
    totalCandidatesTokens = result.response.usageMetadata.candidatesTokenCount || totalCandidatesTokens;
  }

  const responseTimeMs = Date.now() - startTime;
  const botResponse = result.response.text() || '';

  logWeeklyReportActivity(userId, botResponse, steps, responseTimeMs, {
    promptTokens: totalPromptTokens,
    candidatesTokens: totalCandidatesTokens,
    totalTokens: totalPromptTokens + totalCandidatesTokens
  });

  console.log(`[NotificationAgent] Agent completed for user ${userId.slice(0, 8)}...`);
};

// ─── Weekly Reports — all users, concurrent batches ──────────────────────────

const runWeeklyReports = async () => {
  try {
    console.log('[NotificationAgent] Running weekly reports...');
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
    throw err;
  }
};

module.exports = { checkMissingTransactions, runWeeklyReports, runFinancialAdvisorLoop };

