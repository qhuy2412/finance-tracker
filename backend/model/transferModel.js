const db = require("../config/db");


const Transfer = {
    getAllTrasnfersByUserId: async (userId) => {
        const [rows] = await db.execute(
            'SELECT t.id, t.from_wallet_id, t.to_wallet_id, t.amount, t.transfer_date, w1.name AS from_wallet_name, w2.name AS to_wallet_name ' +
            'FROM transfers t ' +
            'JOIN wallets w1 ON t.from_wallet_id = w1.id ' +
            'JOIN wallets w2 ON t.to_wallet_id = w2.id ' +
            'WHERE t.user_id = ?',
            [userId]
        );
        return rows;
    },
};
module.exports = Transfer;