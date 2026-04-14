const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { resolveWalletId } = require('./financeEntityResolver');
const { createHttpError } = require('./financeErrors');
const Saving = require('../model/savingModel');

const transferFinance = {
    async createTransfer(userId, params = {}) {
        const {
            from_wallet_id,
            to_wallet_id,
            from_wallet_name,
            to_wallet_name,
            amount,
            transaction_date,
            note,
        } = params;

        if ((!from_wallet_id && !from_wallet_name) || (!to_wallet_id && !to_wallet_name) || !amount || !transaction_date) {
            throw createHttpError(400, 'Lack of required field!');
        }
        if (Number(amount) <= 0) {
            throw createHttpError(400, 'Transfer amount must be greater than 0!');
        }

        const resolvedFromId = await resolveWalletId(userId, { wallet_id: from_wallet_id, wallet_name: from_wallet_name });
        const resolvedToId = await resolveWalletId(userId, { wallet_id: to_wallet_id, wallet_name: to_wallet_name });

        if (resolvedFromId === resolvedToId) {
            throw createHttpError(400, 'Original wallet and destination wallet are the same!');
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [wallets] = await connection.execute(
                'SELECT id, balance FROM wallets WHERE id IN (?, ?) AND user_id = ? FOR UPDATE',
                [resolvedFromId, resolvedToId, userId]
            );

            if (wallets.length !== 2) {
                throw createHttpError(
                    400,
                    'Original wallet or destination wallet not found or you are not the owner of both wallets!'
                );
            }

            const fromWallet = wallets.find((w) => w.id === resolvedFromId);
            if (!fromWallet) throw createHttpError(400, 'From wallet not found');

            // Kiểm tra số dư khả dụng (trừ tiền đang dành cho tiết kiệm)
            const reservedRows = await Saving.getReservedAmountPerWallet(userId);
            const reservedEntry = reservedRows.find(r => r.wallet_id === resolvedFromId);
            const reservedAmount = reservedEntry ? Number(reservedEntry.reserved) : 0;
            const availableBalance = Number(fromWallet.balance) - reservedAmount;

            if (availableBalance < Number(amount)) {
                throw createHttpError(400, `Số dư khả dụng không đủ để chuyển tiền! Khả dụng: ${availableBalance.toLocaleString('vi-VN')} ₫ (tổng ${Number(fromWallet.balance).toLocaleString('vi-VN')} ₫ - đang tiết kiệm ${reservedAmount.toLocaleString('vi-VN')} ₫).`);
            }

            const transferId = uuidv4().trim();
            await connection.execute(
                `INSERT INTO transfers
                (id, user_id, from_wallet_id, to_wallet_id, amount, transfer_date)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [transferId, userId, resolvedFromId, resolvedToId, Number(amount), transaction_date]
            );

            await connection.execute('UPDATE wallets SET balance = balance - ? WHERE id = ?', [
                Number(amount),
                resolvedFromId,
            ]);
            await connection.execute('UPDATE wallets SET balance = balance + ? WHERE id = ?', [
                Number(amount),
                resolvedToId,
            ]);

            const transOutId = uuidv4().trim();
            const transInId = uuidv4().trim();
            const safeNote = note || 'Chuyển tiền nội bộ';

            await connection.execute(
                `INSERT INTO transactions
                (id, user_id, wallet_id, type, amount, transaction_date, note)
                VALUES (?, ?, ?, 'TRANSFER_OUT', ?, ?, ?)`,
                [transOutId, userId, resolvedFromId, Number(amount), transaction_date, safeNote]
            );
            await connection.execute(
                `INSERT INTO transactions
                (id, user_id, wallet_id, type, amount, transaction_date, note)
                VALUES (?, ?, ?, 'TRANSFER_IN', ?, ?, ?)`,
                [transInId, userId, resolvedToId, Number(amount), transaction_date, safeNote]
            );

            await connection.commit();
            return {
                message: 'Transfer money successfully!',
                data: {
                    from_wallet: resolvedFromId,
                    to_wallet: resolvedToId,
                    transferred_amount: Number(amount),
                },
            };
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
    },
};

module.exports = transferFinance;

