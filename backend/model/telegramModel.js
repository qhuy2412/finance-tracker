const db = require('../config/db');

const TelegramAccount = {
    /**
     * Link a telegram_chat_id to a FinTra user_id.
     * Uses INSERT ... ON DUPLICATE KEY UPDATE to handle re-linking.
     */
    linkAccount: async (telegramChatId, userId) => {
        await db.execute(
            `INSERT INTO telegram_accounts (telegram_chat_id, user_id)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), linked_at = CURRENT_TIMESTAMP`,
            [telegramChatId, userId]
        );
    },

    /** Returns the FinTra user_id for a given telegram_chat_id, or null. */
    getUserIdByChatId: async (telegramChatId) => {
        const [rows] = await db.execute(
            'SELECT user_id FROM telegram_accounts WHERE telegram_chat_id = ? LIMIT 1',
            [telegramChatId]
        );
        return rows[0]?.user_id || null;
    },

    /** Returns linked telegram_chat_id for a FinTra user_id, or null. */
    getChatIdByUserId: async (userId) => {
        const [rows] = await db.execute(
            'SELECT telegram_chat_id FROM telegram_accounts WHERE user_id = ? LIMIT 1',
            [userId]
        );
        return rows[0]?.telegram_chat_id || null;
    },

    /** Unlink telegram account from a FinTra user. */
    unlinkByUserId: async (userId) => {
        await db.execute(
            'DELETE FROM telegram_accounts WHERE user_id = ?',
            [userId]
        );
    },
};

module.exports = TelegramAccount;
