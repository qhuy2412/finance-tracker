const db = require('../config/db');
const Budget = require('../model/budgetModel');
const { v4: uuidv4 } = require('uuid');
const { resolveCategoryId } = require('./financeEntityResolver');
const { createHttpError } = require('./financeErrors');

const budgetFinance = {
    async setBudget(userId, params = {}) {
        const { category_id, category_name, amount, month, year } = params;
        if (!category_id && !category_name) {
            throw createHttpError(400, 'Lack of required field!');
        }
        if (amount === undefined || month === undefined || year === undefined) {
            throw createHttpError(400, 'Lack of required field!');
        }

        const resolvedCategoryId = await resolveCategoryId(userId, { category_id, category_name });
        const period = `${Number(year)}-${String(month).padStart(2, '0')}-01`;

        const sql = `
            INSERT INTO budgets (id, user_id, category_id, amount, period)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount)
        `;
        const id = uuidv4().trim();
        await db.execute(sql, [id, userId, resolvedCategoryId, Number(amount), period]);
        return { message: 'Budget set successfully!' };
    },

    getBudgetStatusByUserId: (userId) => Budget.getBudgetStatusByUserId(userId),

    async deleteBudget(userId, budgetId) {
        if (!budgetId) throw createHttpError(400, 'Budget ID is required');
        const [result] = await db.execute('DELETE FROM budgets WHERE id = ? AND user_id = ?', [budgetId, userId]);
        if (result.affectedRows === 0) {
            throw createHttpError(404, 'Budget not found or not authorized');
        }
        return { message: 'Budget deleted successfully' };
    }
};

module.exports = budgetFinance;

