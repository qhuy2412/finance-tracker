const db = require('../config/db');

const getDashboardStats = async (req, res) => {
    const userId = req.user.id;

    try {
        // 1. Total Balance
        const [[{ totalBalance }]] = await db.execute(
            'SELECT SUM(balance) as totalBalance FROM wallets WHERE user_id = ?',
            [userId]
        );

        // 2. Monthly Income
        const [[{ monthlyIncome }]] = await db.execute(
            `SELECT SUM(amount) as monthlyIncome 
             FROM transactions 
             WHERE user_id = ? AND type = 'INCOME' 
             AND MONTH(transaction_date) = MONTH(CURRENT_DATE()) 
             AND YEAR(transaction_date) = YEAR(CURRENT_DATE())`,
            [userId]
        );

        // 3. Monthly Expense
        const [[{ monthlyExpense }]] = await db.execute(
            `SELECT SUM(amount) as monthlyExpense 
             FROM transactions 
             WHERE user_id = ? AND type = 'EXPENSE' 
             AND MONTH(transaction_date) = MONTH(CURRENT_DATE()) 
             AND YEAR(transaction_date) = YEAR(CURRENT_DATE())`,
            [userId]
        );

        // 4. Chart Data: Expense grouped by category for CURRENT MONTH
        const [chartData] = await db.execute(
            `SELECT c.name as name, SUM(t.amount) as value 
             FROM transactions t 
             JOIN categories c ON t.category_id = c.id 
             WHERE t.user_id = ? AND t.type = 'EXPENSE' 
             AND MONTH(t.transaction_date) = MONTH(CURRENT_DATE()) 
             AND YEAR(t.transaction_date) = YEAR(CURRENT_DATE())
             GROUP BY c.name
             ORDER BY value DESC`,
            [userId]
        );

        // 5. Recent Transactions
        const [recentTransactions] = await db.execute(
            `SELECT t.*, c.name as category_name, w.name as wallet_name 
             FROM transactions t 
             LEFT JOIN categories c ON t.category_id = c.id 
             LEFT JOIN wallets w ON t.wallet_id = w.id 
             WHERE t.user_id = ? 
             ORDER BY t.transaction_date DESC LIMIT 5`,
            [userId]
        );

        res.status(200).json({
            message: "Dashboard stats fetched successfully",
            data: {
                totalBalance: parseFloat(totalBalance || 0),
                monthlyIncome: parseFloat(monthlyIncome || 0),
                monthlyExpense: parseFloat(monthlyExpense || 0),
                chartData: chartData.map(c => ({
                    ...c,
                    value: parseFloat(c.value)
                })),
                recentTransactions
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getDashboardStats };
