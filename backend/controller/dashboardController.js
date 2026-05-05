const db = require('../config/db');

const getDashboardStats = async (req, res) => {
    const userId = req.user.id;

    try {
        // Chạy song song tất cả queries — giảm latency từ 5 roundtrips xuống còn 1 batch
        // Dùng DATE_FORMAT thay vì MONTH()/YEAR() để MySQL có thể tận dụng index trên transaction_date
        const [
            [[{ totalBalance }]],
            [[{ monthlyIncome }]],
            [[{ monthlyExpense }]],
            [chartData],
            [recentTransactions],
        ] = await Promise.all([
            // 1. Total Balance
            db.execute(
                'SELECT COALESCE(SUM(balance), 0) as totalBalance FROM wallets WHERE user_id = ?',
                [userId]
            ),
            // 2. Monthly Income — dùng DATE_FORMAT để tận dụng index
            db.execute(
                `SELECT COALESCE(SUM(amount), 0) as monthlyIncome
                 FROM transactions
                 WHERE user_id = ? AND type = 'INCOME'
                   AND transaction_date >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
                   AND transaction_date <  DATE_FORMAT(CURRENT_DATE + INTERVAL 1 MONTH, '%Y-%m-01')`,
                [userId]
            ),
            // 3. Monthly Expense
            db.execute(
                `SELECT COALESCE(SUM(amount), 0) as monthlyExpense
                 FROM transactions
                 WHERE user_id = ? AND type = 'EXPENSE'
                   AND transaction_date >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
                   AND transaction_date <  DATE_FORMAT(CURRENT_DATE + INTERVAL 1 MONTH, '%Y-%m-01')`,
                [userId]
            ),
            // 4. Chart Data: Expense grouped by category for CURRENT MONTH
            db.execute(
                `SELECT c.name as name, SUM(t.amount) as value
                 FROM transactions t
                 JOIN categories c ON t.category_id = c.id
                 WHERE t.user_id = ? AND t.type = 'EXPENSE'
                   AND t.transaction_date >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
                   AND t.transaction_date <  DATE_FORMAT(CURRENT_DATE + INTERVAL 1 MONTH, '%Y-%m-01')
                 GROUP BY c.name
                 ORDER BY value DESC`,
                [userId]
            ),
            // 5. Recent Transactions (5 gần nhất)
            db.execute(
                `SELECT t.*, c.name as category_name, w.name as wallet_name
                 FROM transactions t
                 LEFT JOIN categories c ON t.category_id = c.id
                 LEFT JOIN wallets w ON t.wallet_id = w.id
                 WHERE t.user_id = ?
                 ORDER BY t.transaction_date DESC, t.created_at DESC
                 LIMIT 5`,
                [userId]
            ),
        ]);

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
        console.error('[Dashboard]', error.message);
        res.status(500).json({ error: 'Lỗi khi tải dữ liệu dashboard.' });
    }
};

module.exports = { getDashboardStats };
