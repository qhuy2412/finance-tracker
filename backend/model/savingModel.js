const db = require("../config/db");
const Saving = {
    getAllSavingsByUserId: async (userId) => {
        const [rows] = await db.execute(
            'SELECT * FROM savings WHERE user_id = ?',
            [userId]
        );
        return rows;
    },
    createSaving: async (savingId, userId, walletId, amount, name, target_amount, deadline) => {
        await db.execute(
            `INSERT INTO saving_goals (id, user_id, name, target_amount, current_amount, deadline, status) 
             VALUES (?, ?, ?, ?, 0.00, ?, 'IN_PROGRESS')`,
            [savingId, userId, name, target_amount, deadline || null]
        );
    },
    updateProgress: async (savingId, amount) => {
        await db.execute(
            `UPDATE saving_goals SET current_amount = current_amount + ? WHERE id = ?`,
            [amount, savingId]
        );
    }
};
module.exports = Saving;

