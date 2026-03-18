const {uuid: uuidv4} = require('uuid');
const setBudget = async (req, res) => {
    const userId = req.user.id;
    const { category_id, amount, month, year } = req.body;

    if (!category_id || !amount || !month || !year) {
        return res.status(400).json({ message: "Lack of required field!" });
    }

    try {
        const sql = `
            INSERT INTO budgets (id, user_id, category_id, amount, month, year) 
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount)
        `;
        const id = uuidv4().trim();
        await db.execute(sql, [id, userId, category_id, amount, month, year]);

        res.status(201).json({ message: "Budget set successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const getBudgetStatus = async (req, res) => {
    const userId = req.user.id;
    const { month, year } = req.query; 

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
                AND MONTH(t.transaction_date) = b.month
                AND YEAR(t.transaction_date) = b.year
            WHERE b.user_id = ? AND b.month = ? AND b.year = ?
            GROUP BY b.id, c.name, c.icon, b.amount
        `;

        const [results] = await db.execute(sql, [userId, month, year]);
        
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
module.exports = { setBudget, getBudgetStatus };