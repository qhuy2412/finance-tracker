const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const financeService = require('../services/financeService');
const { logUserActivity } = require('../utils/logger');
const setBudget = async (req, res) => {
    const userId = req.user.id;
    const { category_id, amount } = req.body;
    try {
        const result = await financeService.setBudget(userId, req.body);

        logUserActivity(userId, 'CREATE_BUDGET', `Thiết lập/cập nhật ngân sách danh mục ${category_id} với số tiền: ${Number(amount).toLocaleString('vi-VN')} ₫`, req);

        return res.status(201).json(result);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ message: error.message });
    }
};
const getBudgetStatus = async (req, res) => {
    const userId = req.user.id;
    const { month, year } = req.query; 

    const period = `${year}-${String(month).padStart(2, '0')}-01`;

    try {
        const sql = `
            SELECT 
                b.id as budget_id,
                c.name as category_name,
                c.icon as category_icon,
                b.amount as budget_limit,
                COALESCE(SUM(t.amount), 0) as spent_amount,
                (b.amount - COALESCE(SUM(t.amount), 0)) as remaining_amount
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            LEFT JOIN transactions t ON b.category_id = t.category_id 
                AND t.user_id = b.user_id
                AND t.type = 'EXPENSE'
                AND MONTH(t.transaction_date) = MONTH(b.period)
                AND YEAR(t.transaction_date) = YEAR(b.period)
            WHERE b.user_id = ? AND b.period = ?
            GROUP BY b.id, c.name, c.icon, b.amount
        `;

        const [results] = await db.execute(sql, [userId, period]);
        
        res.status(200).json(results);
    } catch (error) {
        console.error("Error fetching budget status:", error.message);
        res.status(500).json({ error: error.message });
    }
};

const deleteBudget = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await financeService.deleteBudget(userId, id);

        logUserActivity(userId, 'DELETE_BUDGET', `Xóa ngân sách ID ${id}`, req);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ message: error.message });
    }
};

module.exports = { setBudget, getBudgetStatus, deleteBudget };