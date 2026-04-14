const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const Wallet = require('../model/walletModel');
const Category = require('../model/categoryModel');
const Transaction = require('../model/transactionModel');
const Saving = require('../model/savingModel');
const { createHttpError } = require('./financeErrors');
const { resolveWalletId, resolveCategoryId } = require('./financeEntityResolver');

const transactionFinance = {
    async createTransaction(userId, params = {}) {
        const {
            wallet_id,
            wallet_name,
            category_id,
            category_name,
            type,
            amount,
            transaction_date,
            note,
        } = params;

        if (
            !type ||
            amount === undefined ||
            !transaction_date ||
            (!wallet_id && !wallet_name) ||
            (!category_id && !category_name)
        ) {
            throw createHttpError(400, 'Type, amount, transaction_date, wallet and category are required!');
        }

        if (Number(amount) < 0) {
            throw createHttpError(400, 'Amount must be a positive number!');
        }
        if (type !== 'INCOME' && type !== 'EXPENSE') {
            throw createHttpError(400, 'Type must be either INCOME or EXPENSE!');
        }

        const connection = await db.getConnection();
        const resolvedWalletId = await resolveWalletId(userId, { wallet_id, wallet_name });
        const resolvedCategoryId = await resolveCategoryId(userId, { category_id, category_name });

        try {
            await connection.beginTransaction();

            const wallet = await Wallet.findById(resolvedWalletId, connection);
            if (!wallet) throw createHttpError(404, 'Wallet not found!');
            if (wallet.user_id !== userId) {
                throw createHttpError(403, 'You are not authorized to add transaction to this wallet!');
            }

            const category = await Category.findById(resolvedCategoryId, connection);
            if (!category) throw createHttpError(404, 'Category not found!');
            if (category.user_id !== userId && category.user_id !== null) {
                throw createHttpError(403, 'You are not authorized to use this category!');
            }

            // Tính số dư khả dụng = tổng số dư - tiền đang dành cho tiết kiệm
            const reservedRows = await Saving.getReservedAmountPerWallet(userId);
            const reservedEntry = reservedRows.find(r => r.wallet_id === resolvedWalletId);
            const reservedAmount = reservedEntry ? Number(reservedEntry.reserved) : 0;
            const availableBalance = Number(wallet.balance) - reservedAmount;

            if (type === 'EXPENSE' && availableBalance < Number(amount)) {
                throw createHttpError(400, `Số dư khả dụng không đủ! Khả dụng: ${availableBalance.toLocaleString('vi-VN')} ₫ (tổng ${Number(wallet.balance).toLocaleString('vi-VN')} ₫ - đang tiết kiệm ${reservedAmount.toLocaleString('vi-VN')} ₫).`);
            }

            const balanceChange = type === 'INCOME' ? Number(amount) : -Number(amount);
            await Wallet.updateBalance(resolvedWalletId, balanceChange, connection);

            const transactionId = uuidv4().trim();
            await Transaction.createNormalTransaction(
                transactionId,
                userId,
                resolvedWalletId,
                resolvedCategoryId,
                type,
                Number(amount),
                transaction_date,
                note || '',
                connection
            );

            await connection.commit();
            return { message: 'Transaction created successfully!' };
        } catch (e) {
            await connection.rollback();
            throw e;
        } finally {
            connection.release();
        }
    },
};

module.exports = transactionFinance;

