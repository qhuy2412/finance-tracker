const db = require("../config/db");
const Saving = {
    getAllSavingsByUserId: async (userId) => {
        const [rows] = await db.execute(
            'SELECT * FROM saving_goals WHERE user_id = ? ORDER BY deadline ASC',
            [userId]
        );
        return rows;
    },
    createSaving: async (savingId, userId, name, target_amount, current_amount, deadline) => {
        await db.execute(
            `INSERT INTO saving_goals (id, user_id, name, target_amount, current_amount, deadline, status) 
             VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS')`,
            [savingId, userId, name, target_amount, current_amount, deadline || null]
        );
    },
    updateProgress: async (savingId, amount) => {
        await db.execute(
            `UPDATE saving_goals SET current_amount = current_amount + ? WHERE id = ?`,
            [amount, savingId]
        );
    },
    deleteSaving: async (savingId, userId) => {
        await db.execute(
            `DELETE FROM saving_goals WHERE id = ? AND user_id = ?`,
            [savingId, userId]
        );
    }
};
module.exports = Saving;

