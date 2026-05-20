const TelegramBot = require('node-telegram-bot-api');
const TelegramAccount = require('../model/telegramModel');
const telegramLinkService = require('../services/telegramLinkService');
const { processChatMessage } = require('../services/chatService');

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
    await bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, { parse_mode: 'Markdown' });
};

const handleHelpCommand = async (msg) => {
    await bot.sendMessage(msg.chat.id, HELP_MESSAGE, { parse_mode: 'Markdown' });
};

const handleLinkCommand = async (msg, match) => {
    const chatId = msg.chat.id;
    const linkToken = match[1].trim().toUpperCase();

    const userId = telegramLinkService.verifyAndConsumeLinkToken(linkToken);
    if (!userId) {
        return bot.sendMessage(chatId,
            '❌ Mã liên kết không hợp lệ hoặc đã hết hạn (10 phút).\n\nVào FinTra App → Settings → Liên kết Telegram để lấy mã mới.'
        );
    }

    try {
        await TelegramAccount.linkAccount(chatId, userId);
        // Reset session when account is newly linked
        telegramSessions.delete(chatId);
        return bot.sendMessage(chatId,
            '✅ Đã liên kết tài khoản FinTra thành công!\n\nBây giờ bạn có thể hỏi mình bất cứ điều gì về tài chính của bạn. Thử hỏi: "Tôi có bao nhiêu tiền?" 💰'
        );
    } catch (e) {
        console.error('[Telegram] Link account error:', e);
        return bot.sendMessage(chatId, '❌ Có lỗi xảy ra khi liên kết. Vui lòng thử lại.');
    }
};

const handleUnlinkCommand = async (msg) => {
    const chatId = msg.chat.id;
    try {
        const userId = await TelegramAccount.getUserIdByChatId(chatId);
        if (!userId) {
            return bot.sendMessage(chatId, 'ℹ️ Bạn chưa liên kết tài khoản FinTra nào.');
        }
        await TelegramAccount.unlinkByUserId(userId);
        telegramSessions.delete(chatId);
        return bot.sendMessage(chatId, '✅ Đã hủy liên kết tài khoản FinTra.');
    } catch (e) {
        console.error('[Telegram] Unlink error:', e);
        return bot.sendMessage(chatId, '❌ Có lỗi xảy ra. Vui lòng thử lại.');
    }
};

const handleNewSessionCommand = async (msg) => {
    const chatId = msg.chat.id;
    telegramSessions.delete(chatId);
    return bot.sendMessage(chatId, '🔄 Đã bắt đầu cuộc trò chuyện mới. Bạn cần gì nào?');
};

const handleFreeTextMessage = async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return; // ignore commands (handled above)
    if (!msg.text) {
        return bot.sendMessage(msg.chat.id, 'Mình chỉ hiểu tin nhắn văn bản thôi nhé. Bạn thử gõ câu hỏi của mình.');
    }

    const chatId = msg.chat.id;

    // Lookup linked FinTra user
    let userId;
    try {
        userId = await TelegramAccount.getUserIdByChatId(chatId);
    } catch (e) {
        console.error('[Telegram] DB lookup error:', e);
        return bot.sendMessage(chatId, '❌ Lỗi hệ thống. Vui lòng thử lại sau.');
    }

    if (!userId) {
        return bot.sendMessage(chatId,
            '🔗 Bạn chưa liên kết tài khoản FinTra.\n\nVào *FinTra App* → Settings → Liên kết Telegram để lấy mã, sau đó gửi `/link FINTRA_XXXX` cho mình nhé.',
            { parse_mode: 'Markdown' }
        );
    }

    // Show typing indicator (fire-and-forget, do not block on failure)
    bot.sendChatAction(chatId, 'typing').catch(() => {});

    const sessionId = getSession(chatId);

    try {
        const { reply, sessionId: newSessionId } = await processChatMessage(userId, msg.text, sessionId);
        setSession(chatId, newSessionId);
        return bot.sendMessage(chatId, reply);
    } catch (e) {
        if (e.status === 404 || e.status === 403) {
            telegramSessions.delete(chatId);
            try {
                const { reply, sessionId: newSessionId } = await processChatMessage(userId, msg.text, null);
                setSession(chatId, newSessionId);
                return bot.sendMessage(chatId, reply);
            } catch (retryError) {
                console.error('[Telegram] Retry error:', retryError);
                return bot.sendMessage(chatId, '❌ Có lỗi xảy ra. Vui lòng thử lại.');
            }
        }
        console.error('[Telegram] Chat processing error:', e);
        return bot.sendMessage(chatId, '❌ Có lỗi xảy ra khi xử lý tin nhắn. Vui lòng thử lại.');
    }
};

/**
 * Initialize and start the Telegram bot (Webhook or Polling mode).
 * Called once when the server starts.
 */
const initTelegramBot = () => {
    if (!token) {
        console.warn('[Telegram] TELEGRAM_BOT_API not set — bot will not start.');
        return;
    }

    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    const isWebhookEnabled = webhookUrl && 
                             webhookUrl !== 'undefined' && 
                             webhookUrl !== 'null' && 
                             webhookUrl.trim() !== '';

    console.log('[Telegram] Starting bot initialization...');
    console.log(`[Telegram] Detected NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[Telegram] Detected PM2 instance: ${process.env.NODE_APP_INSTANCE}`);
    console.log(`[Telegram] TELEGRAM_WEBHOOK_URL configured: "${webhookUrl}" (Parsed as enabled: ${!!isWebhookEnabled})`);

    if (isWebhookEnabled) {
        // Webhook mode: do not poll, register webhook URL
        bot = new TelegramBot(token);
        bot.setWebHook(webhookUrl)
            .then(() => console.log(`[Telegram] Bot configured with Webhook: ${webhookUrl}`))
            .catch(err => console.error('[Telegram] Webhook setup failed:', err.message));
    } else {
        // Polling mode (only on the primary instance if using PM2 cluster mode)
        const isPrimaryInstance = process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0';
        if (!isPrimaryInstance) {
            console.log(`[Telegram] Polling skipped on PM2 worker ${process.env.NODE_APP_INSTANCE} to prevent conflicts.`);
            return;
        }

        bot = new TelegramBot(token, { polling: true });
        console.log('[Telegram] Bot started with polling.');

        bot.on('polling_error', (err) => {
            console.error('[Telegram] Polling error:', err.message);
        });
    }

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
        return res.json({ message: 'Đã hủy liên kết tài khoản Telegram.' });
    } catch (e) {
        console.error('[Telegram] Unlink error:', e);
        return res.status(500).json({ message: 'Không thể hủy liên kết.' });
    }
};

module.exports = { initTelegramBot, generateLinkToken, getLinkStatus, unlinkAccount, handleWebhook };