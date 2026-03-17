const db = require("../config/db");

const Wallet = {
    getAllWalletsByUserId: async (userId) => {
        const [results] = await db.query('SELECT * FROM wallets WHERE user_id = ?',[userId]);
        return results;
    },
};
module.exports = Wallet;