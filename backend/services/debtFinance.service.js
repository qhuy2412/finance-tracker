const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { resolveWalletId } = require('./financeEntityResolver');
const { createHttpError } = require('./financeErrors');

const debtFinance = {
    async createDebt(userId, params = {}) {
        const {
            wallet_id,
            wallet_name,
            person_name,
            type,
            amount,
            due_date,
            note,
            transaction_date,
        } = params;

        if ((!wallet_id && !wallet_name) || !person_name || !type || amount === undefined || !transaction_date) {
            throw createHttpError(400, 'Lack of required field!');
        }
        if (type !== 'BORROW' && type !== 'LEND') {
            throw createHttpError(400, 'The type of debt is invalid!');
        }
        if (Number(amount) <= 0) {
            throw createHttpError(400, 'The amount must be greater than 0!');
        }

        if (due_date && due_date < transaction_date) {
            throw createHttpError(400, 'Due date must be greater than transaction date!');
        }

        const resolvedWalletId = await resolveWalletId(userId, { wallet_id, wallet_name });
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [wallets] = await connection.execute(
                'SELECT * FROM wallets WHERE id = ? AND user_id = ? FOR UPDATE',
                [resolvedWalletId, userId]
            );
            const wallet = wallets[0];
            if (!wallet) {
                throw createHttpError(400, 'Wallet not found!');
            }

            if (type === 'LEND' && Number(wallet.balance) < Number(amount)) {
                throw createHttpError(400, 'Balance of this wallet is not enough for lend!');
            }

            const debtId = uuidv4().trim();
            await connection.execute(
                `INSERT INTO debts
                (id, user_id, wallet_id, person_name, type, amount, paid_amount, status, due_date, note)
                VALUES (?, ?, ?, ?, ?, ?, 0, 'UNPAID', ?, ?)`,
                [debtId, userId, resolvedWalletId, person_name, type, Number(amount), due_date || null, note || '']
            );

            const balanceChange = type === 'BORROW' ? Number(amount) : -Number(amount);
            await connection.execute('UPDATE wallets SET balance = balance + ? WHERE id = ?', [
                balanceChange,
                resolvedWalletId,
            ]);

            const transId = uuidv4().trim();
            const transType = type === 'BORROW' ? 'DEBT_IN' : 'DEBT_OUT';
            const transNote = type === 'BORROW' ? `Vay tiền từ: ${person_name}` : `Cho vay: ${person_name}`;

            await connection.execute(
                `INSERT INTO transactions
                (id, user_id, wallet_id, debt_id, type, amount, transaction_date, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [transId, userId, resolvedWalletId, debtId, transType, Number(amount), transaction_date, note || transNote]
            );

            await connection.commit();
            return {
                message: 'Create debt and update wallet successfully!',
                data: { id: debtId, type, amount, status: 'UNPAID' },
            };
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
    },
};

module.exports = debtFinance;

