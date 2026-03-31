const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const Wallet = require('../model/walletModel');
const Category = require('../model/categoryModel');
const Transaction = require('../model/transactionModel');
const Saving = require('../model/savingModel');
const Budget = require('../model/budgetModel');

// Note: Transfer/Debt controllers currently use raw SQL, so we keep same DB behavior in service.

const createHttpError = (statusCode, message) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
};

const resolveWalletId = async (userId, params = {}) => {
    if (params.wallet_id) return params.wallet_id;
    if (params.wallet_name) {
        const w = await Wallet.findByName(userId, params.wallet_name);
        if (!w) throw createHttpError(400, `Wallet not found: ${params.wallet_name}`);
        return w.id;
    }
    throw createHttpError(400, 'Missing wallet_id/wallet_name');
};

const resolveCategoryId = async (userId, params = {}) => {
    if (params.category_id) return params.category_id;
    if (params.category_name) {
        const c = await Category.findByName(userId, params.category_name);
        if (!c) throw createHttpError(400, `Category not found: ${params.category_name}`);
        return c.id;
    }
    throw createHttpError(400, 'Missing category_id/category_name');
};

const financeService = {
    async createWallet(userId, { name, type, balance }) {
        if (!name || !type || balance === undefined) {
            throw createHttpError(400, 'Name, type, and balance are required!');
        }
        if (Number(balance) < 0) {
            throw createHttpError(400, 'Balance must be a positive number!');
        }

        const existingWallet = await Wallet.findByName(userId, name);
        if (existingWallet) {
            throw createHttpError(400, 'Wallet name already exists!');
        }

        const walletId = uuidv4().trim();
        await Wallet.createWallet(walletId, userId, name, type, Number(balance));
        return { message: 'Wallet created successfully!' };
    },

    async createCategory(userId, { name, type, color, icon }) {
        if (!name || !type) {
            throw createHttpError(400, 'Name and type are required!');
        }

        const existingCategory = await Category.findByName(userId, name);
        if (existingCategory) {
            throw createHttpError(400, 'Category name already exists!');
        }

        const categoryId = uuidv4().trim();
        await Category.createCategory(categoryId, userId, name, type, color, icon);
        return { message: 'Category created successfully!' };
    },

    // Create normal transaction (INCOME/EXPENSE) by wallet/category names or ids
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

        if (!type || amount === undefined || !transaction_date || (!wallet_id && !wallet_name) || (!category_id && !category_name)) {
            throw createHttpError(400, 'Type, amount, transaction_date, wallet and category are required!');
        }
        if (amount < 0) {
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
            if (wallet.user_id !== userId) throw createHttpError(403, 'You are not authorized to add transaction to this wallet!');

            const category = await Category.findById(resolvedCategoryId, connection);
            if (!category) throw createHttpError(404, 'Category not found!');
            if (category.user_id !== userId && category.user_id !== null) {
                throw createHttpError(403, 'You are not authorized to use this category!');
            }

            if (type === 'EXPENSE' && Number(wallet.balance) < Number(amount)) {
                throw createHttpError(400, 'Not enough balance in wallet!');
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
            if (Number(fromWallet.balance) < Number(amount)) {
                throw createHttpError(400, 'Original wallet does not have enough balance to perform the transfer!');
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

    async createSaving(userId, params = {}) {
        const { name, target_amount, current_amount, deadline } = params;
        if (!name || target_amount === undefined) {
            throw createHttpError(400, 'Name, target_amount are required!');
        }
        if (Number(target_amount) < 0) {
            throw createHttpError(400, 'Target amount must be a positive number!');
        }

        const savingId = uuidv4().trim();
        await Saving.createSaving(
            savingId,
            userId,
            name,
            Number(target_amount),
            current_amount === undefined ? 0 : Number(current_amount),
            deadline || null
        );
        return { message: 'Saving goal created successfully!' };
    },

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

        if (!due_date) {
            // keep null
        } else {
            if (due_date < transaction_date) {
                throw createHttpError(400, 'Due date must be greater than transaction date!');
            }
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

    async setBudget(userId, params = {}) {
        const { category_id, category_name, amount, month, year } = params;
        if (!category_id && !category_name) {
            throw createHttpError(400, 'Lack of required field!');
        }
        if (amount === undefined || month === undefined || year === undefined) {
            throw createHttpError(400, 'Lack of required field!');
        }

        const resolvedCategoryId = await resolveCategoryId(userId, { category_id, category_name });
        const period = `${Number(year)}-${String(month).padStart(2, '0')}-01`;

        const sql = `
            INSERT INTO budgets (id, user_id, category_id, amount, period)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount)
        `;
        const id = uuidv4().trim();
        await db.execute(sql, [id, userId, resolvedCategoryId, Number(amount), period]);

        return { message: 'Budget set successfully!' };
    },

    // (Optional) allow other parts to reuse read logic via existing models.
    getBudgetStatusByUserId: (userId) => Budget.getBudgetStatusByUserId(userId),
};

const walletFinance = require('./walletFinance.service');
const categoryFinance = require('./categoryFinance.service');
const transactionFinance = require('./transactionFinance.service');
const transferFinance = require('./transferFinance.service');
const savingFinance = require('./savingFinance.service');
const debtFinance = require('./debtFinance.service');
const budgetFinance = require('./budgetFinance.service');

// Facade: keep the same API surface, but delegate implementation to small modules.
module.exports = {
    createWallet: (userId, params) => walletFinance.createWallet(userId, params),
    createCategory: (userId, params) => categoryFinance.createCategory(userId, params),
    createTransaction: (userId, params) => transactionFinance.createTransaction(userId, params),
    createTransfer: (userId, params) => transferFinance.createTransfer(userId, params),
    createSaving: (userId, params) => savingFinance.createSaving(userId, params),
    createDebt: (userId, params) => debtFinance.createDebt(userId, params),
    setBudget: (userId, params) => budgetFinance.setBudget(userId, params),
    getBudgetStatusByUserId: (userId) => budgetFinance.getBudgetStatusByUserId(userId),
};

