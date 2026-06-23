const TelegramBot = require('node-telegram-bot-api');
const TelegramAccount = require('../model/telegramModel');
const telegramLinkService = require('../services/telegramLinkService');
const { processChatMessage } = require('../services/chatService');
const { logUserActivity } = require('../utils/logger');

const token = process.env.TELEGRAM_BOT_API;

let bot = null;

// Telegram session store: maps telegram_chat_id -> sessionId (in-memory per restart)
// Sessions persist in DB, so chat history survives restarts.
const telegramSessions = new Map();

const getSession = (chatId) => {
    return telegramSessions.get(chatId) || null;
};

const setSession = (chatId, sessionId) => {
    telegramSessions.set(chatId, sessionId);
};

const WELCOME_MESSAGE =
    `👋 Chào mừng đến với *FinTra Bot*!\n\n` +
    `Tôi là trợ lý AI tài chính của bạn. Để bắt đầu, bạn cần liên kết tài khoản FinTra:\n\n` +
    `1️⃣ Vào *FinTra App* → Settings → Liên kết Telegram\n` +
    `2️⃣ Lấy mã liên kết (ví dụ: \`FINTRA_ABC123\`)\n` +
    `3️⃣ Gửi cho tôi: \`/link FINTRA_ABC123\`\n\n` +
    `Sau khi liên kết, bạn có thể chat với tôi để xem số dư, chi tiêu, ghi giao dịch, v.v.`;

const HELP_MESSAGE =
    `📚 *Hướng dẫn sử dụng FinTra Bot*\n\n` +
    `🔗 */link FINTRA_XXXX* — Liên kết tài khoản FinTra\n` +
    `❌ */unlink* — Hủy liên kết tài khoản\n` +
    `🔄 */newsession* — Bắt đầu cuộc trò chuyện mới\n` +
    `❓ */help* — Xem hướng dẫn này\n\n` +
    `💬 Hoặc chỉ cần nhắn tin bình thường để chat với AI tài chính của bạn!`;

const handleStartCommand = async (msg) => {
    await bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, { parse_mode: 'Markdown' })
        .catch(err => console.error('[Telegram] Start command failed:', err.message));
};

const handleHelpCommand = async (msg) => {
    await bot.sendMessage(msg.chat.id, HELP_MESSAGE, { parse_mode: 'Markdown' })
        .catch(err => console.error('[Telegram] Help command failed:', err.message));
};

const handleLinkCommand = async (msg, match) => {
    const chatId = msg.chat.id;
    const linkToken = match[1].trim().toUpperCase();

    const userId = telegramLinkService.verifyAndConsumeLinkToken(linkToken);
    if (!userId) {
        return bot.sendMessage(chatId,
            '❌ Mã liên kết không hợp lệ hoặc đã hết hạn (10 phút).\n\nVào FinTra App → Settings → Liên kết Telegram để lấy mã mới.'
        ).catch(err => console.error('[Telegram] Link expired alert failed:', err.message));
    }

    try {
        await TelegramAccount.linkAccount(chatId, userId);
        // Reset session when account is newly linked
        telegramSessions.delete(chatId);

        logUserActivity(userId, 'LINK_TELEGRAM', 'Linked Telegram account via bot', { telegram_chat_id: chatId });

        return bot.sendMessage(chatId,
            '✅ Đã liên kết tài khoản FinTra thành công!\n\nBây giờ bạn có thể hỏi mình bất cứ điều gì về tài chính của bạn. Thử hỏi: "Tôi có bao nhiêu tiền?" 💰'
        ).catch(err => console.error('[Telegram] Link success alert failed:', err.message));
    } catch (e) {
        console.error('[Telegram] Link account error:', e);
        return bot.sendMessage(chatId, '❌ Có lỗi xảy ra khi liên kết. Vui lòng thử lại.')
            .catch(err => console.error('[Telegram] Link error alert failed:', err.message));
    }
};

const handleUnlinkCommand = async (msg) => {
    const chatId = msg.chat.id;
    try {
        const userId = await TelegramAccount.getUserIdByChatId(chatId);
        if (!userId) {
            return bot.sendMessage(chatId, 'ℹ️ Bạn chưa liên kết tài khoản FinTra nào.')
                .catch(err => console.error('[Telegram] Unlinked status alert failed:', err.message));
        }
        await TelegramAccount.unlinkByUserId(userId);
        telegramSessions.delete(chatId);

        logUserActivity(userId, 'UNLINK_TELEGRAM', 'Unlinked Telegram account via bot', { telegram_chat_id: chatId });

        return bot.sendMessage(chatId, '✅ Đã hủy liên kết tài khoản FinTra.')
            .catch(err => console.error('[Telegram] Unlink success alert failed:', err.message));
    } catch (e) {
        console.error('[Telegram] Unlink error:', e);
        return bot.sendMessage(chatId, '❌ Có lỗi xảy ra. Vui lòng thử lại.')
            .catch(err => console.error('[Telegram] Unlink error alert failed:', err.message));
    }
};

const handleNewSessionCommand = async (msg) => {
    const chatId = msg.chat.id;
    telegramSessions.delete(chatId);
    return bot.sendMessage(chatId, '🔄 Đã bắt đầu cuộc trò chuyện mới. Bạn cần gì nào?')
        .catch(err => console.error('[Telegram] New session alert failed:', err.message));
};

const handleFreeTextMessage = async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return; // ignore commands (handled above)
    if (!msg.text) {
        return bot.sendMessage(msg.chat.id, 'Mình chỉ hiểu tin nhắn văn bản thôi nhé. Bạn thử gõ câu hỏi của mình.')
            .catch(err => console.error('[Telegram] Non-text warning failed:', err.message));
    }

    const chatId = msg.chat.id;

    // Lookup linked FinTra user
    let userId;
    try {
        userId = await TelegramAccount.getUserIdByChatId(chatId);
    } catch (e) {
        console.error('[Telegram] DB lookup error:', e);
        return bot.sendMessage(chatId, '❌ Lỗi hệ thống. Vui lòng thử lại sau.')
            .catch(err => console.error('[Telegram] DB error alert failed:', err.message));
    }

    if (!userId) {
        return bot.sendMessage(chatId,
            '🔗 Bạn chưa liên kết tài khoản FinTra.\n\nVào *FinTra App* → Settings → Liên kết Telegram để lấy mã, sau đó gửi `/link FINTRA_XXXX` cho mình nhé.',
            { parse_mode: 'Markdown' }
        ).catch(err => console.error('[Telegram] Link invite failed:', err.message));
    }

    // Show typing indicator (fire-and-forget, do not block on failure)
    bot.sendChatAction(chatId, 'typing').catch(() => {});

    const sessionId = getSession(chatId);

    try {
        const { reply, sessionId: newSessionId } = await processChatMessage(userId, msg.text, sessionId);
        setSession(chatId, newSessionId);
        return bot.sendMessage(chatId, reply)
            .catch(err => console.error('[Telegram] Send reply failed:', err.message));
    } catch (e) {
        if (e.status === 404 || e.status === 403) {
            telegramSessions.delete(chatId);
            try {
                const { reply, sessionId: newSessionId } = await processChatMessage(userId, msg.text, null);
                setSession(chatId, newSessionId);
                return bot.sendMessage(chatId, reply)
                    .catch(err => console.error('[Telegram] Send retry reply failed:', err.message));
            } catch (retryError) {
                console.error('[Telegram] Retry error:', retryError);
                return bot.sendMessage(chatId, '❌ Có lỗi xảy ra. Vui lòng thử lại.')
                    .catch(err => console.error('[Telegram] Retry error alert failed:', err.message));
            }
        }
        console.error('[Telegram] Chat processing error:', e);
        return bot.sendMessage(chatId, '❌ Có lỗi xảy ra khi xử lý tin nhắn. Vui lòng thử lại.')
            .catch(err => console.error('[Telegram] General error alert failed:', err.message));
    }
};

/**
 * Initialize and start the Telegram bot (Webhook or Polling mode).
 * Called once when the server starts.
 */
const initTelegramBot = () => {
    if (bot) {
        console.log(`[Telegram] Bot already initialized on process ${process.pid}. Skipping re-initialization.`);
        return;
    }

    if (!token) {
        console.warn(`[Telegram] TELEGRAM_BOT_API not set on process ${process.pid} — bot will not start.`);
        return;
    }

    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    const isWebhookEnabled = webhookUrl && 
                             webhookUrl !== 'undefined' && 
                             webhookUrl !== 'null' && 
                             webhookUrl.trim() !== '';

    if (isWebhookEnabled) {
        // Webhook mode: do not poll, register webhook URL
        console.log(`[Telegram] Process ${process.pid} attempting to register Webhook URL: [${webhookUrl}]`);
        bot = new TelegramBot(token, { request: { timeout: 10000 } });
        bot.setWebHook(webhookUrl)
            .then(() => console.log(`[Telegram] Bot configured with Webhook (Process ${process.pid}): ${webhookUrl}`))
            .catch(err => console.error(`[Telegram] Webhook setup failed (Process ${process.pid}):`, err.message));
    } else {
        // Polling mode (only on the primary instance if using PM2 cluster mode)
        const isPrimaryInstance = process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0';
        if (!isPrimaryInstance) {
            console.log(`[Telegram] Polling skipped on PM2 worker ${process.env.NODE_APP_INSTANCE} (Process ${process.pid}) to prevent conflicts.`);
            return;
        }

        // request.timeout MUST exceed polling.params.timeout to avoid premature HTTP aborts
        bot = new TelegramBot(token, {
            polling: {
                interval: 300,
                autoStart: true,
                params: { timeout: 25 },
            },
            request: { timeout: 35000 },
        });
        console.log(`[Telegram] Bot started with polling on process ${process.pid}.`);

        // Track last successful poll to detect silent connection drops
        let lastPollActivity = Date.now();
        bot.on('message', () => { lastPollActivity = Date.now(); });
        bot.on('polling_error', () => { lastPollActivity = Date.now(); });

        // Watchdog: restart polling if no activity for 5 minutes (silent drop)
        const WATCHDOG_INTERVAL_MS = 60 * 1000;
        const MAX_IDLE_MS = 5 * 60 * 1000;
        const watchdog = setInterval(async () => {
            const idleMs = Date.now() - lastPollActivity;
            if (idleMs > MAX_IDLE_MS) {
                console.warn(`[Telegram] Watchdog: No polling activity for ${Math.round(idleMs / 1000)}s on process ${process.pid}. Restarting polling...`);
                lastPollActivity = Date.now();
                try {
                    await bot.stopPolling();
                    await bot.startPolling();
                    console.log(`[Telegram] Polling restarted by watchdog on process ${process.pid}.`);
                } catch (err) {
                    console.error(`[Telegram] Watchdog restart failed on process ${process.pid}:`, err.message);
                }
            }
        }, WATCHDOG_INTERVAL_MS);
        if (watchdog.unref) watchdog.unref();

        let pollingErrorCount = 0;
        bot.on('polling_error', (err) => {
            pollingErrorCount++;
            console.error(`[Telegram] Polling error #${pollingErrorCount} on process ${process.pid}:`, err.message);

            // Auto-restart polling after repeated fatal errors
            if (pollingErrorCount >= 5) {
                pollingErrorCount = 0;
                console.warn(`[Telegram] Too many polling errors. Restarting polling on process ${process.pid}...`);
                setTimeout(async () => {
                    try {
                        await bot.stopPolling();
                        await bot.startPolling();
                        console.log(`[Telegram] Polling restarted after errors on process ${process.pid}.`);
                    } catch (restartErr) {
                        console.error(`[Telegram] Auto-restart failed on process ${process.pid}:`, restartErr.message);
                    }
                }, 3000);
            }
        });
    }

    // Graceful shutdown listeners
    const handleShutdown = async () => {
        if (bot) {
            console.log(`[Telegram] Process ${process.pid} is terminating. Stopping Telegram bot polling cleanly...`);
            try {
                if (typeof bot.stopPolling === 'function') {
                    await bot.stopPolling();
                    console.log(`[Telegram] Polling stopped cleanly on process ${process.pid}.`);
                }
            } catch (err) {
                console.error(`[Telegram] Error during graceful shutdown of bot polling on process ${process.pid}:`, err.message);
            }
        }
    };

    process.once('SIGINT', handleShutdown);
    process.once('SIGTERM', handleShutdown);

    // Register handlers (used for both webhook and polling modes)
    bot.onText(/\/start/, handleStartCommand);
    bot.onText(/\/help/, handleHelpCommand);
    bot.onText(/\/link\s+(\S+)/, handleLinkCommand);
    bot.onText(/\/unlink/, handleUnlinkCommand);
    bot.onText(/\/newsession/, handleNewSessionCommand);
    bot.on('message', handleFreeTextMessage);
};

// ─── HTTP API handlers ──────────────────────────────────────────────────────

/**
 * POST /api/telegram/webhook
 * Receives updates from Telegram in webhook mode.
 */
const handleWebhook = (req, res) => {
    if (!bot) {
        return res.status(500).json({ message: 'Bot not initialized.' });
    }
    try {
        bot.processUpdate(req.body);
        return res.sendStatus(200);
    } catch (e) {
        console.error('[Telegram Webhook Error]', e);
        return res.status(500).json({ message: 'Error processing update.' });
    }
};

/**
 * POST /api/telegram/generate-link-token
 * Auth required. Returns a short-lived token for linking Telegram account.
 */
const generateLinkToken = (req, res) => {
    try {
        const token = telegramLinkService.generateLinkToken(req.user.id);

        logUserActivity(req.user.id, 'GENERATE_TELEGRAM_LINK_TOKEN', 'Generate Telegram link token', null, req);

        return res.json({ token, expires_in_minutes: 10 });
    } catch (e) {
        console.error('[Telegram] Generate token error:', e);
        return res.status(500).json({ message: 'Không thể tạo mã liên kết.' });
    }
};

/**
 * GET /api/telegram/status
 * Auth required. Returns whether the user has a linked Telegram account.
 */
const getLinkStatus = async (req, res) => {
    try {
        const chatId = await TelegramAccount.getChatIdByUserId(req.user.id);
        return res.json({ linked: chatId !== null });
    } catch (e) {
        console.error('[Telegram] Status error:', e);
        return res.status(500).json({ message: 'Không thể kiểm tra trạng thái.' });
    }
};

/**
 * DELETE /api/telegram/unlink
 * Auth required. Removes the linked Telegram account for the current user.
 */
const unlinkAccount = async (req, res) => {
    try {
        await TelegramAccount.unlinkByUserId(req.user.id);

        logUserActivity(req.user.id, 'UNLINK_TELEGRAM', 'Unlinked Telegram account from Web app', null, req);

        return res.json({ message: 'Đã hủy liên kết tài khoản Telegram.' });
    } catch (e) {
        console.error('[Telegram] Unlink error:', e);
        return res.status(500).json({ message: 'Không thể hủy liên kết.' });
    }
};

let adminBot = null;

/**
 * Sends a Telegram message to all admin-linked Telegram accounts.
 * Used for system alerts (e.g. backup failure notifications).
 */
const sendTelegramToAdmins = async (text) => {
    const adminBotToken = process.env.TELEGRAM_ADMIN_BOT_API;
    const adminChatIdStr = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!adminBotToken || !adminChatIdStr) {
        console.warn('[Telegram] Cannot send admin alert — TELEGRAM_ADMIN_BOT_API or TELEGRAM_ADMIN_CHAT_ID is not configured.');
        return;
    }

    if (!adminBot) {
        adminBot = new TelegramBot(adminBotToken, { polling: false });
    }

    const chatIds = adminChatIdStr.split(',').filter(Boolean);
    for (const chatId of chatIds) {
        try {
            await adminBot.sendMessage(chatId.trim(), text, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error(`[Telegram] Failed to send admin alert to chat ${chatId}:`, err.message);
        }
    }
};

module.exports = { initTelegramBot, generateLinkToken, getLinkStatus, unlinkAccount, handleWebhook, sendTelegramToAdmins };