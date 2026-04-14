const db = require("../config/db");

const Saving = {
    getAllSavingsByUserId: async (userId) => {
        const [rows] = await db.execute(
            'SELECT * FROM saving_goals WHERE user_id = ? ORDER BY deadline ASC',
            [userId]
        );
        return rows;
    },

    getSavingById: async (savingId, userId) => {
        const [rows] = await db.execute(
            'SELECT * FROM saving_goals WHERE id = ? AND user_id = ?',
            [savingId, userId]
        );
        return rows[0];
    },

    createSaving: async (savingId, userId, name, target_amount, current_amount, deadline, linked_wallet_id) => {
        await db.execute(
            `INSERT INTO saving_goals (id, user_id, name, target_amount, current_amount, deadline, status, linked_wallet_id) 
             VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?)`,
            [savingId, userId, name, target_amount, current_amount, deadline || null, linked_wallet_id || null]
        );
    },

    updateCurrentAmount: async (savingId, newAmount, status) => {
        await db.execute(
            `UPDATE saving_goals SET current_amount = ?, status = ? WHERE id = ?`,
            [newAmount, status, savingId]
        );
    },

    deleteSaving: async (savingId, userId) => {
        await db.execute(
            `DELETE FROM saving_goals WHERE id = ? AND user_id = ?`,
            [savingId, userId]
        );
    },

    // Ghi lịch sử nạp / rút theo từng ví
    createSavingTransaction: async (id, savingId, walletId, type, amount, note) => {
        await db.execute(
            `INSERT INTO saving_transactions (id, saving_id, wallet_id, type, amount, note)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, savingId, walletId, type, amount, note || null]
        );
    },

    // Lịch sử giao dịch của 1 mục tiêu (kèm tên ví)
    getSavingTransactions: async (savingId) => {
        const [rows] = await db.execute(
            `SELECT st.*, w.name AS wallet_name
             FROM saving_transactions st
             LEFT JOIN wallets w ON st.wallet_id = w.id
             WHERE st.saving_id = ?
             ORDER BY st.created_at DESC`,
            [savingId]
        );
        return rows;
    },

    // Số tiền đang "reserved" theo từng ví (DEPOSIT - WITHDRAW của các mục tiêu IN_PROGRESS)
    getReservedAmountPerWallet: async (userId) => {
        const [rows] = await db.execute(
            `SELECT st.wallet_id,
                    SUM(CASE WHEN st.type = 'DEPOSIT' THEN st.amount ELSE -st.amount END) AS reserved
             FROM saving_transactions st
             JOIN saving_goals sg ON st.saving_id = sg.id
             WHERE sg.user_id = ? AND sg.status = 'IN_PROGRESS'
             GROUP BY st.wallet_id
             HAVING reserved > 0`,
            [userId]
        );
        return rows;
    },

    getWalletContribution: async (savingId, walletId) => {
        const [rows] = await db.execute(
            `SELECT SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE -amount END) AS contribution
             FROM saving_transactions
             WHERE saving_id = ? AND wallet_id = ?`,
            [savingId, walletId]
        );
        return rows[0].contribution ? Number(rows[0].contribution) : 0;
    },
};

module.exports = Saving;
