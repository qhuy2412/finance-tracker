/**
 * chatService.js
 * Shared chat processing logic reused by both HTTP API (chatControllerV3)
 * and Telegram bot (telegramController) — no req/res dependency.
 */

const { v4: uuidv4 } = require('uuid');
const Chat = require('../model/chatModel');
const { runAgentLoop, checkConfirmationIntent } = require('./agentServiceV3');
const financeService = require('./financeService');
const { sanitizeHistoryLine } = require('../utils/promptsV2');
const { formatTransactionConfirmText, formatTransactionErrorVi } = require('../utils/chatFormatters');

const PENDING_TTL_MS = 10 * 60 * 1000;

// Shared pending store (keyed by sessionId)
const pendingActions = new Map();

const _cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [sid, entry] of pendingActions.entries()) {
        if (now - entry.createdAt > PENDING_TTL_MS) pendingActions.delete(sid);
    }
}, 5 * 60 * 1000);
// Allow process to exit cleanly — unref the timer
if (_cleanupTimer.unref) _cleanupTimer.unref();


const buildGenAIHistory = (messages) =>
    messages
        .slice(-14)
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: sanitizeHistoryLine(m.content) }],
        }));

/**
 * Process a chat message for a given userId.
 * Manages its own session lifecycle (creates session if needed).
 * Returns { reply: string, sessionId: string }
 *
 * @param {string} userId - FinTra user ID
 * @param {string} message - raw text from user
 * @param {string|null} sessionId - existing session ID, or null to auto-create
 */
const processChatMessage = async (userId, message, sessionId = null) => {
    if (!message || !message.trim()) {
        return { reply: 'Bạn nhắn gì đó đi, mình sẵn sàng hỗ trợ!', sessionId };
    }

    let dbMessages = [];
    let effectiveSessionId = sessionId;

    if (!effectiveSessionId) {
        effectiveSessionId = uuidv4();
        await Chat.createSession(effectiveSessionId, userId);
    } else {
        const { owner, messages } = await Chat.getSessionWithMessages(effectiveSessionId);
        if (!owner) {
            const error = new Error('Session not found');
            error.status = 404;
            throw error;
        }
        if (owner !== userId) {
            const error = new Error('Forbidden');
            error.status = 403;
            throw error;
        }
        dbMessages = messages;
    }

    const saveAndReturn = async (reply) => {
        await Promise.all([
            Chat.saveMessage(uuidv4(), effectiveSessionId, 'user', message),
            Chat.saveMessage(uuidv4(), effectiveSessionId, 'assistant', reply),
            Chat.touchSession(effectiveSessionId),
        ]).catch(e => console.error('[ChatService] Save failed:', e));
        return { reply, sessionId: effectiveSessionId };
    };

    // Check pending transaction confirmation
    const pending = pendingActions.get(effectiveSessionId);
    if (pending) {
        if (Date.now() - pending.createdAt > PENDING_TTL_MS) {
            pendingActions.delete(effectiveSessionId);
        } else {
            const intent = await checkConfirmationIntent(message);
            if (intent === 'CANCEL') {
                pendingActions.delete(effectiveSessionId);
                return saveAndReturn('Mình đã hủy thao tác lưu giao dịch.');
            } else if (intent === 'CONFIRM') {
                pendingActions.delete(effectiveSessionId);
                try {
                    await financeService.createTransaction(userId, {
                        wallet_name:      pending.data.wallet_name,
                        category_name:    pending.data.category_name,
                        type:             pending.data.type,
                        amount:           pending.data.amount,
                        transaction_date: pending.data.date,
                        note:             pending.data.note || '',
                    });
                    return saveAndReturn('Đã ghi giao dịch thành công nhé! 🎉');
                } catch (e) {
                    return saveAndReturn(formatTransactionErrorVi(e.message));
                }
            } else {
                pendingActions.delete(effectiveSessionId);
            }
        }
    }

    // Run agent loop
    const genAIHistory = buildGenAIHistory(dbMessages);
    const agentResult = await runAgentLoop(userId, message.trim(), genAIHistory);

    switch (agentResult.type) {
        case 'FINAL_ANSWER':
            return saveAndReturn(agentResult.payload);

        case 'CLARIFICATION':
            return saveAndReturn(agentResult.payload);

        case 'PENDING_TRANSACTION': {
            const txData = agentResult.payload;
            pendingActions.set(effectiveSessionId, { data: txData, createdAt: Date.now() });
            return saveAndReturn(formatTransactionConfirmText(txData));
        }

        case 'ERROR':
        default:
            return saveAndReturn(agentResult.payload || 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
};

module.exports = { processChatMessage };
