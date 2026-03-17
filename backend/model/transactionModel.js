const db = require("../config/db");
const Transaction = {
    getAllTransactionsByWalletId: async (walletId) => {
        const [rows] = await db.execute('SELECT * FROM transactions WHERE wallet_id = ?', [walletId]);
        return rows;
    },
    createNormalTransaction: async (transactionId,userId, walletId, categoryId,type, amount, transaction_date, note,connection) => {
        return await connection.execute('INSERT INTO transactions (id,user_id, wallet_id, category_id,type, amount, transaction_date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [transactionId, userId, walletId, categoryId, type, amount, transaction_date, note]);
    }
};
module.exports = Transaction;