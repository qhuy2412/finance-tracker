const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const setBudget = async (req, res) => {
    const userId = req.user.id;
    const { category_id, amount, month, year } = req.body;

    if (!category_id || !amount || !month || !year) {
        return res.status(400).json({ message: "Lack of required field!" });
    }

    // Convert month and year to a date string YYYY-MM-01 matching the period column
    const period = `${year}-${String(month).padStart(2, '0')}-01`;

    try {
        const sql = `
            INSERT INTO budgets (id, user_id, category_id, amount, period) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount)
        `;
        const id = uuidv4().trim();
        await db.execute(sql, [id, userId, category_id, amount, period]);

        res.status(201).json({ message: "Budget set successfully!" });
    } catch (error) {
        console.error("Error setting budget:", error.message);
        res.status(500).json({ error: error.message });
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
module.exports = { setBudget, getBudgetStatus };