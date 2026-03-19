const db = require("../config/db");
const Transaction = require("../model/transactionModel");
const Wallet = require("../model/walletModel");
const Category = require("../model/categoryModel");
const { v4: uuidv4 } = require('uuid');
const getAllTransactionsByWalletId = async (req, res) => {
    try {
        const walletId = req.params.walletId;
        const transactions = await Transaction.getAllTransactionsByWalletId(walletId);
        return res.status(200).json(transactions);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
const createNormalTransaction = async (req, res) => {
    const userId = req.user.id;
    const walletId = req.params.walletId;
    const {categoryId,type, amount, transaction_date, note} = req.body;
    if (!type || amount === undefined || !transaction_date || !categoryId || !walletId) {
        return res.status(400).json({ message: "Type, amount, transaction_date, categoryId, and walletId are required!" });
    }
    if (amount < 0) {
        return res.status(400).json({ message: "Amount must be a positive number!" });
    }
    if(type !== 'INCOME' && type !== 'EXPENSE') {
        return res.status(400).json({ message: "Type must be either INCOME or EXPENSE!" });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        // Check if wallet exists and belongs to user
        const wallet = await Wallet.findById(walletId,connection);
        if (!wallet) {
            return res.status(404).json({ message: "Wallet not found!" });
        }
        if (wallet.user_id !== userId) {
            return res.status(403).json({ message: "You are not authorized to add transaction to this wallet!" });
        }
        //Check if category exists and belongs to user
        const category = await Category.findById(categoryId,connection);
        if (!category) {
            return res.status(404).json({ message: "Category not found!" });
        }
        if (category.user_id !== userId && category.user_id !== null) {
            return res.status(403).json({ message: "You are not authorized to use this category!" });
        }
        // Check if wallet has enough balance for expense transaction
        if (type === 'EXPENSE' && wallet.balance < amount) {
            return res.status(400).json({ message: "Not enough balance in wallet!" });
        }
        // Create transaction
        const balanceChange = type === 'INCOME' ? amount : -amount;
        await Wallet.updateBalance(walletId, balanceChange,connection);
        const transactionId = uuidv4().trim();
        await Transaction.createNormalTransaction(transactionId, userId, walletId, categoryId, type, amount, transaction_date, note,connection);
        await connection.commit();
        return res.status(201).json({ message: "Transaction created successfully!" });
    } catch (error) {
        await connection.rollback();
        return res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const deleteTransaction = async (req, res) => {
    const transactionId = req.params.transactionId;
    const userId = req.user.id;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const transaction = await Transaction.getTransactionById(transactionId, connection);
        // Check if wallet exists and belongs to user
        const wallet = await Wallet.findById(transaction.wallet_id, connection);
        if (!wallet) {
            await connection.rollback();
            return res.status(404).json({ message: "Wallet not found!" });
        }
        if (wallet.user_id !== userId) {
            await connection.rollback();
            return res.status(403).json({ message: "You are not authorized to delete transaction from this wallet!" });
        }

        // Get the transaction details
        if (!transaction) {
            await connection.rollback();
            return res.status(404).json({ message: "Transaction not found!" });
        }

        // Reverse the wallet balance
        const balanceReversal = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount;
        await Wallet.updateBalance(transaction.wallet_id, balanceReversal, connection);

        // Delete the transaction
        await Transaction.deleteTransaction(transactionId, connection);
        
        await connection.commit();
        return res.status(200).json({ message: "Transaction deleted successfully!" });
    } catch (error) {
        await connection.rollback();
        return res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

module.exports = { getAllTransactionsByWalletId, createNormalTransaction, deleteTransaction };