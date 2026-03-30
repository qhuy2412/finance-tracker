const db = require("../config/db");

const Budget = {
    // Dùng trong chatController để lấy ngân sách + chi tiêu thực tế tháng hiện tại
    getBudgetStatusByUserId: async (userId) => {
        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const [rows] = await db.execute(
            `SELECT 
                c.name AS category_name,
                c.icon AS category_icon,
                b.amount AS budget_limit,
                COALESCE(SUM(t.amount), 0) AS spent_amount,
                (b.amount - COALESCE(SUM(t.amount), 0)) AS remaining_amount
             FROM budgets b
             JOIN categories c ON b.category_id = c.id
             LEFT JOIN transactions t 
                ON b.category_id = t.category_id
                AND t.user_id = b.user_id
                AND t.type = 'EXPENSE'
                AND MONTH(t.transaction_date) = MONTH(b.period)
                AND YEAR(t.transaction_date) = YEAR(b.period)
             WHERE b.user_id = ? AND b.period = ?
             GROUP BY b.id, c.name, c.icon, b.amount`,
            [userId, period]
        );
        return rows;
    }
};

module.exports = Budget;
