const db = require("../config/db");
const Transaction = {
    getAllTransactionsByWalletId: async (walletId) => {
        const [rows] = await db.execute('SELECT * FROM transactions WHERE wallet_id = ?', [walletId]);
        return rows;
    },
    createNormalTransaction: async (transactionId,userId, walletId, categoryId,type, amount, transaction_date, note,connection) => {
        return await connection.execute('INSERT INTO transactions (id,user_id, wallet_id, category_id,type, amount, transaction_date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [transactionId, userId, walletId, categoryId, type, amount, transaction_date, note]);
    },
    getTransactionById: async (transactionId, connection) => {
        const [rows] = await connection.execute('SELECT * FROM transactions WHERE id = ?', [transactionId]);
        return rows[0];
    },
    updateTransaction: async (transactionId, categoryId, type, amount, transaction_date, note, connection) => {
        return await connection.execute(
            'UPDATE transactions SET category_id = ?, type = ?, amount = ?, transaction_date = ?, note = ? WHERE id = ?',
            [categoryId, type, amount, transaction_date, note, transactionId]
        );
    },
    deleteTransaction: async (transactionId, connection) => {
        return await connection.execute('DELETE FROM transactions WHERE id = ?', [transactionId]);
    },
    getAllTransactionsByUserId: async (userId) => {
        const [rows] = await db.execute('SELECT * FROM transactions WHERE user_id = ? order by transaction_date desc, created_date desc', [userId]);
        return rows;
    }
};
module.exports = Transaction;