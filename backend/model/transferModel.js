const db = require("../config/db");


const Transfer = {
    createTransfer: async (transferId, userId, fromWalletId, toWalletId, amount, transactionDate, note, connection) => {
        const [result] = await connection.execute(
            `INSERT INTO transfers 
            (id, user_id, from_wallet_id, to_wallet_id, amount, transfer_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transferId, userId, fromWalletId, toWalletId, amount, transactionDate, note]
        );
        return result;
    }
}