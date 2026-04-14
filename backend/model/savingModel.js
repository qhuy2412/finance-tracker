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

    // Số tiền đang "reserved" theo từng ví, tính dựa trên tỉ lệ đóng góp (DEPOSIT) vào current_amount
    getReservedAmountPerWallet: async (userId) => {
        const [goals] = await db.execute(
            `SELECT id, current_amount FROM saving_goals WHERE user_id = ? AND status = 'IN_PROGRESS' AND current_amount > 0`,
            [userId]
        );
        
        if (goals.length === 0) return [];
        
        const goalIds = goals.map(g => g.id);
        const placeholders = goalIds.map(() => '?').join(',');
        
        // Lấy lịch sử nạp tiền (DEPOSIT) của các mục tiêu này
        const [deposits] = await db.execute(
            `SELECT saving_id, wallet_id, SUM(amount) as deposited 
             FROM saving_transactions 
             WHERE type = 'DEPOSIT' AND saving_id IN (${placeholders})
             GROUP BY saving_id, wallet_id`,
            goalIds
        );
        
        const reservedMap = {};
        
        for (const goal of goals) {
            const goalDeposits = deposits.filter(d => d.saving_id === goal.id);
            const totalDeposited = goalDeposits.reduce((sum, d) => sum + Number(d.deposited), 0);
            const currentC = Number(goal.current_amount);
            
            if (totalDeposited > 0 && currentC > 0) {
                for (const d of goalDeposits) {
                    const wId = d.wallet_id;
                    const walletShare = (Number(d.deposited) / totalDeposited) * currentC;
                    reservedMap[wId] = (reservedMap[wId] || 0) + walletShare;
                }
            }
        }
        
        return Object.entries(reservedMap).map(([wallet_id, reserved]) => ({
            wallet_id,
            reserved: Math.round(reserved)
        }));
    },
};

module.exports = Saving;
