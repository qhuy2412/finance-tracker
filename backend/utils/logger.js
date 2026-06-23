const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('../config/db');

const LOGS_DIR = path.join(__dirname, '../logs');

// Ensure the logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const SERVER_ID = process.env.SERVER_ID || os.hostname();
const IS_DEV = process.env.NODE_ENV !== 'production';

// Helper to write JSON Lines to file
const writeToFile = (filename, data) => {
    const filePath = path.join(LOGS_DIR, filename);
    const logEntry = JSON.stringify(data) + '\n';
    
    fs.appendFile(filePath, logEntry, (err) => {
        if (err) {
            console.error(`[Logger Error] Failed to write to ${filename}:`, err);
        }
    });
};

const saveUserActivityLog = async (logData) => {
    try {
        const sql = `
            INSERT INTO user_activity_logs (user_id, action, details, payload, ip, user_agent, server_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const dbUserId = (logData.userId && logData.userId !== 'anonymous') ? logData.userId : null;
        
        await db.execute(sql, [
            dbUserId,
            logData.action,
            logData.details,
            logData.payload ? JSON.stringify(logData.payload) : null,
            logData.ip || null,
            logData.userAgent || null,
            logData.server
        ]);
    } catch (err) {
        console.error('[Logger Database Error] Failed to write user activity log:', err);
    }
};

const saveAgentActivityLog = async (logData, agentType) => {
    try {
        const sql = `
            INSERT INTO agent_activity_logs (
                user_id, session_id, agent_type, user_message, bot_response, steps, response_time_ms,
                prompt_tokens, candidates_tokens, total_tokens, estimated_cost_usd, server_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const dbUserId = (logData.userId && logData.userId !== 'anonymous') ? logData.userId : null;
        const dbSessionId = (logData.sessionId && logData.sessionId !== 'new-session') ? logData.sessionId : null;
        
        const promptTokens = logData.tokenUsage ? logData.tokenUsage.promptTokens : null;
        const candidatesTokens = logData.tokenUsage ? logData.tokenUsage.candidatesTokens : null;
        const totalTokens = logData.tokenUsage ? logData.tokenUsage.totalTokens : null;
        
        await db.execute(sql, [
            dbUserId,
            dbSessionId,
            agentType,
            logData.userMessage || null,
            logData.botResponse,
            JSON.stringify(logData.steps),
            logData.responseTimeMs,
            promptTokens,
            candidatesTokens,
            totalTokens,
            logData.estimatedCostUSD,
            logData.server
        ]);
    } catch (err) {
        console.error('[Logger Database Error] Failed to write agent activity log:', err);
    }
};

/**
 * Log a user action to user_activity.log and stdout.
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Action identifier (e.g., 'LOGIN', 'CREATE_TRANSACTION')
 * @param {string} details - Human-readable description
 * @param {object|null} req - Express Request object to extract IP and User-Agent
 */
const logUserActivity = (userId, action, details, arg4 = null, arg5 = null) => {
    let payload = null;
    let req = null;

    // Detect if arg4 is the Express request object or log payload
    if (arg4 && (arg4.headers || arg4.ip || arg4.socket || arg4.route)) {
        req = arg4;
    } else {
        payload = arg4;
        req = arg5;
    }

    const timestamp = new Date().toISOString();
    const logData = {
        timestamp,
        server: SERVER_ID,
        userId: userId || 'anonymous',
        action,
        details,
        payload: payload || null,
        ip: '',
        userAgent: ''
    };

    if (req) {
        logData.ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        logData.userAgent = req.headers['user-agent'] || '';
        // If IP is loopback IPv6, simplify it
        if (logData.ip === '::1') {
            logData.ip = '127.0.0.1';
        }
    }

    // 1. Write to local file
    writeToFile('user_activity.log', logData);

    // 2. Stream to stdout for docker logs -f
    if (IS_DEV) {
        const colorAction = `\x1b[32m${action}\x1b[0m`;
        const colorServer = `\x1b[36m[${SERVER_ID}]\x1b[0m`;
        const colorDetails = `\x1b[37m${details}\x1b[0m`;
        const colorIp = logData.ip ? `\x1b[33m(IP: ${logData.ip})\x1b[0m` : '';
        console.log(`[UserActivity] ${colorServer} [${colorAction}] User: ${logData.userId} - ${colorDetails} ${colorIp}`);
    } else {
        console.log(JSON.stringify({ logType: 'UserActivity', ...logData }));
    }

    // 3. Save to database (non-blocking)
    saveUserActivityLog(logData).catch(err => console.error('[Logger Unhandled Promise] user activity:', err));
};

// Gemini 2.5 Flash pricing (USD per 1M tokens)
// Source: https://ai.google.dev/gemini-api/docs/pricing (updated June 2026)
const GEMINI_PRICING = {
    inputPerMillion: 0.30,
    outputPerMillion: 2.50,
};

/**
 * Estimate cost in USD from token counts.
 */
const estimateCost = (promptTokens, candidatesTokens) => {
    const inputCost = (promptTokens / 1_000_000) * GEMINI_PRICING.inputPerMillion;
    const outputCost = (candidatesTokens / 1_000_000) * GEMINI_PRICING.outputPerMillion;
    return parseFloat((inputCost + outputCost).toFixed(8));
};

/**
 * Write a human-readable trace log for a chatbot interaction.
 */
const writeTraceLog = (logData) => {
    const divider = '─'.repeat(80);
    const lines = [
        divider,
        `[${logData.timestamp}] SERVER: ${logData.server} | USER: ${logData.userId} | SESSION: ${logData.sessionId}`,
        `⏱  Response time: ${logData.responseTimeMs}ms`,
        ...(logData.tokenUsage ? [
            `🪙 Tokens — Input: ${logData.tokenUsage.promptTokens} | Output: ${logData.tokenUsage.candidatesTokens} | Total: ${logData.tokenUsage.totalTokens} | Est. cost: $${logData.estimatedCostUSD}`,
        ] : []),
        ``,
        `👤 USER: ${logData.userMessage}`,
        ``,
    ];

    if (logData.steps && logData.steps.length > 0) {
        logData.steps.forEach((step) => {
            lines.push(`  🔄 [Iteration ${step.iteration}]`);
            step.toolCalls.forEach((tc) => {
                lines.push(`    🔧 Tool call: ${tc.name}`);
                lines.push(`       Args: ${JSON.stringify(tc.args, null, 0)}`);
            });
            step.observations.forEach((obs) => {
                const resultStr = typeof obs.result === 'object'
                    ? JSON.stringify(obs.result).slice(0, 500)
                    : String(obs.result).slice(0, 500);
                lines.push(`    📊 Result [${obs.toolName}]: ${resultStr}`);
            });
            lines.push('');
        });
    } else {
        lines.push('  (No tools used — direct answer)');
        lines.push('');
    }

    lines.push(`🤖 BOT: ${logData.botResponse}`);
    lines.push('');

    const traceEntry = lines.join('\n') + '\n';
    const filePath = path.join(LOGS_DIR, 'chatbot_trace.log');
    fs.appendFile(filePath, traceEntry, (err) => {
        if (err) console.error('[Logger Error] Failed to write chatbot_trace.log:', err);
    });
};

/**
 * Log chatbot conversation and internal ReAct tool execution steps.
 * @param {string} userId
 * @param {string} sessionId
 * @param {string} userMessage
 * @param {string} botResponse
 * @param {Array}  steps - ReAct steps with toolCalls + observations
 * @param {number} responseTimeMs
 * @param {object|null} tokenUsage - { promptTokens, candidatesTokens, totalTokens }
 */
const logChatbotActivity = (userId, sessionId, userMessage, botResponse, steps, responseTimeMs, tokenUsage = null) => {
    const timestamp = new Date().toISOString();
    const estimatedCostUSD = tokenUsage
        ? estimateCost(tokenUsage.promptTokens, tokenUsage.candidatesTokens)
        : null;

    const logData = {
        timestamp,
        server: SERVER_ID,
        userId: userId || 'anonymous',
        sessionId: sessionId || 'new-session',
        userMessage,
        botResponse,
        steps: steps || [],
        responseTimeMs,
        tokenUsage: tokenUsage || null,
        estimatedCostUSD,
    };

    // 1. Write JSONL to chatbot_agent.log
    writeToFile('chatbot_agent.log', logData);

    // 2. Write human-readable trace to chatbot_trace.log
    writeTraceLog(logData);

    // 3. Stream to stdout for docker logs -f
    if (IS_DEV) {
        const colorServer = `\x1b[36m[${SERVER_ID}]\x1b[0m`;
        const colorTime = `\x1b[33m${responseTimeMs}ms\x1b[0m`;
        const tokenInfo = tokenUsage
            ? `\x1b[90mTokens: ${tokenUsage.totalTokens} | Cost: $${estimatedCostUSD}\x1b[0m`
            : '';
        console.log(`[ChatbotActivity] ${colorServer} User: "${userMessage.slice(0, 50)}" | Time: ${colorTime} ${tokenInfo} | Steps: ${logData.steps.length}`);

        if (logData.steps.length > 0) {
            logData.steps.forEach(step => {
                step.toolCalls.forEach(tc => {
                    console.log(`  └─ [Iter ${step.iteration}] 🔧 ${tc.name}(${JSON.stringify(tc.args).slice(0, 80)})`);
                });
                step.observations.forEach(obs => {
                    const preview = JSON.stringify(obs.result).slice(0, 100);
                    console.log(`         📊 Result: ${preview}`);
                });
            });
        }
    } else {
        console.log(JSON.stringify({ logType: 'ChatbotActivity', ...logData }));
    }

    // 4. Save to database (non-blocking)
    saveAgentActivityLog(logData, 'CHATBOT').catch(err => console.error('[Logger Unhandled Promise] chatbot activity:', err));
};

/**
 * Log weekly report agent conversation and internal ReAct tool execution steps.
 * @param {string} userId
 * @param {string} botResponse
 * @param {Array}  steps - ReAct steps with toolCalls + observations
 * @param {number} responseTimeMs
 * @param {object|null} tokenUsage - { promptTokens, candidatesTokens, totalTokens }
 */
const logWeeklyReportActivity = (userId, botResponse, steps, responseTimeMs, tokenUsage = null) => {
    const timestamp = new Date().toISOString();
    const estimatedCostUSD = tokenUsage
        ? estimateCost(tokenUsage.promptTokens, tokenUsage.candidatesTokens)
        : null;

    const logData = {
        timestamp,
        server: SERVER_ID,
        userId: userId || 'anonymous',
        botResponse,
        steps: steps || [],
        responseTimeMs,
        tokenUsage: tokenUsage || null,
        estimatedCostUSD,
    };

    // 1. Write JSONL to weekly_report_agent.log
    writeToFile('weekly_report_agent.log', logData);

    // 2. Write human-readable trace to weekly_report_trace.log
    const divider = '─'.repeat(80);
    const lines = [
        divider,
        `[${logData.timestamp}] WEEKLY REPORT | SERVER: ${logData.server} | USER: ${logData.userId}`,
        `⏱  Response time: ${logData.responseTimeMs}ms`,
        ...(logData.tokenUsage ? [
            `🪙 Tokens — Input: ${logData.tokenUsage.promptTokens} | Output: ${logData.tokenUsage.candidatesTokens} | Total: ${logData.tokenUsage.totalTokens} | Est. cost: $${logData.estimatedCostUSD}`,
        ] : []),
        ``,
    ];

    if (logData.steps && logData.steps.length > 0) {
        logData.steps.forEach((step) => {
            lines.push(`  🔄 [Iteration ${step.iteration}]`);
            step.toolCalls.forEach((tc) => {
                lines.push(`    🔧 Tool call: ${tc.name}`);
                lines.push(`       Args: ${JSON.stringify(tc.args, null, 0)}`);
            });
            step.observations.forEach((obs) => {
                const resultStr = typeof obs.result === 'object'
                    ? JSON.stringify(obs.result).slice(0, 500)
                    : String(obs.result).slice(0, 500);
                lines.push(`    📊 Result [${obs.toolName}]: ${resultStr}`);
            });
            lines.push('');
        });
    }

    lines.push(`🤖 BOT: ${logData.botResponse}`);
    lines.push('');

    const traceEntry = lines.join('\n') + '\n';
    const filePath = path.join(LOGS_DIR, 'weekly_report_trace.log');
    fs.appendFile(filePath, traceEntry, (err) => {
        if (err) console.error('[Logger Error] Failed to write weekly_report_trace.log:', err);
    });

    // 3. Stream to stdout for docker logs -f
    if (IS_DEV) {
        const colorServer = `\x1b[36m[${SERVER_ID}]\x1b[0m`;
        const colorTime = `\x1b[33m${responseTimeMs}ms\x1b[0m`;
        const tokenInfo = tokenUsage
            ? `\x1b[90mTokens: ${tokenUsage.totalTokens} | Cost: $${estimatedCostUSD}\x1b[0m`
            : '';
        console.log(`[WeeklyReportAgent] ${colorServer} User: ${userId} | Time: ${colorTime} ${tokenInfo} | Steps: ${logData.steps.length}`);
    } else {
        console.log(JSON.stringify({ logType: 'WeeklyReportActivity', ...logData }));
    }

    // 4. Save to database (non-blocking)
    saveAgentActivityLog(logData, 'WEEKLY_REPORT').catch(err => console.error('[Logger Unhandled Promise] weekly report activity:', err));
};

module.exports = {
    logUserActivity,
    logChatbotActivity,
    logWeeklyReportActivity
};
