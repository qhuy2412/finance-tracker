const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

const transferMoney = async (req, res) => {
    const userId = req.user.id;
    const { from_wallet_id, to_wallet_id, amount, transaction_date, note } = req.body;


    if (!from_wallet_id || !to_wallet_id || !amount || !transaction_date) {
        return res.status(400).json({ message: "Lack of required field!" });
    }
    if (from_wallet_id === to_wallet_id) {
        return res.status(400).json({ message: "Original wallet and destination wallet are the same!" });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: "Transfer amount must be greater than 0!" });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();


        const [wallets] = await connection.execute(
            'SELECT id, balance FROM wallets WHERE id IN (?, ?) AND user_id = ? FOR UPDATE',
            [from_wallet_id, to_wallet_id, userId]
        );


        if (wallets.length !== 2) {
            throw new Error("Original wallet or destination wallet not found or you are not the owner of both wallets!");
        }


        const fromWallet = wallets.find(w => w.id === from_wallet_id);
        const toWallet = wallets.find(w => w.id === to_wallet_id);

        if (parseFloat(fromWallet.balance) < parseFloat(amount)) {
            throw new Error("Original wallet does not have enough balance to perform the transfer!");
        }
        const transferId = uuidv4().trim();
        await connection.execute(
            `INSERT INTO transfers 
            (id, user_id, from_wallet_id, to_wallet_id, amount, transfer_date) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [transferId, userId, from_wallet_id, to_wallet_id, amount, transaction_date]
        );


        await connection.execute(
            'UPDATE wallets SET balance = balance - ? WHERE id = ?',
            [amount, from_wallet_id]
        );
        
        await connection.execute(
            'UPDATE wallets SET balance = balance + ? WHERE id = ?',
            [amount, to_wallet_id]
        );


        const transOutId = uuidv4().trim();
        const transInId = uuidv4().trim();
        const safeNote = note || 'Chuyển tiền nội bộ'; 


        await connection.execute(
            `INSERT INTO transactions 
            (id, user_id, wallet_id, type, amount, transaction_date, note) 
            VALUES (?, ?, ?, 'TRANSFER_OUT', ?, ?, ?)`,
            [transOutId, userId, from_wallet_id, amount, transaction_date, safeNote]
        );

        await connection.execute(
            `INSERT INTO transactions 
            (id, user_id, wallet_id, type, amount, transaction_date, note) 
            VALUES (?, ?, ?, 'TRANSFER_IN', ?, ?, ?)`,
            [transInId, userId, to_wallet_id, amount, transaction_date, safeNote]
        );

        await connection.commit();

        return res.status(200).json({ 
            message: "Transfer money successfully!",
            data: {
                from_wallet: from_wallet_id,
                to_wallet: to_wallet_id,
                transferred_amount: amount
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        const statusCode = error.message.includes("SQL") ? 500 : 400;
        return res.status(statusCode).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = { transferMoney };