const db = require("../config/db");

const Wallet = {
    getAllWalletsByUserId: async (userId) => {
        const [results] = await db.query('SELECT * FROM wallets WHERE user_id = ?',[userId]);
        return results;
    },
    createWallet: async (walletId, userId, name,type, balance) => {
        return await db.query('INSERT INTO wallets (id,user_id, name,type,balance) VALUES (?,?, ?, ?, ?)', [walletId,userId, name,type, balance]);
    },
    findById: async (id, connection) => {
        if (connection) {
            const [results] = await connection.execute('SELECT * FROM wallets WHERE id = ?',[id]);
            return results[0];
        }
        const [results] = await db.query('SELECT * FROM wallets WHERE id = ?',[id]);
        return results[0];
    },
    updateWallet: async (id, name, type, balance) => {
        return await db.query('UPDATE wallets SET name = ?, type = ?, balance = ? WHERE id = ?', [name, type, balance, id]);
    },
    deleteWallet: async (id) => {
        return await db.query('DELETE FROM wallets WHERE id = ?', [id]);
    },
    findByName: async (userId, name) => {
        const [results] = await db.query('SELECT * FROM wallets WHERE user_id = ? AND name = ?', [userId, name]);
        return results[0];
    },
    updateBalance: async (id, amount, connection) => {
        if (connection) {
            return await connection.execute('UPDATE wallets SET balance = balance + ? WHERE id = ?', [amount, id]);
        }
        return await db.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [amount, id]);
    },
};
module.exports = Wallet;