const db = require("../config/db");
const Debt = {
    getAllDebtsByUserId: async (userId) => {
        const [results] = await db.query('SELECT * FROM debts WHERE user_id = ?',[userId]);
        return results;
    },
    createDebt: async (debtId, userId, name, amount, due_date, note) => {
        return await db.query('INSERT INTO debts (id,user_id, name, amount, due_date, note) VALUES (?, ?, ?, ?, ?, ?)', [debtId, userId, name, amount, due_date, note]);
    },
    findById: async (id) => {
        const [results] = await db.query('SELECT * FROM debts WHERE id = ?',[id]);
        return results[0];
    },
    updateDebt: async (id, name, amount, due_date, note) => {
        return await db.query('UPDATE debts SET name = ?, amount = ?, due_date = ?, note = ? WHERE id = ?', [name, amount, due_date, note, id]);
    },
    deleteDebt: async (id) => {
        return await db.query('DELETE FROM debts WHERE id = ?', [id]);
    }
};
module.exports = Debt;

