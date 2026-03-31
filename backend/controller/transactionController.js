const db = require("../config/db");
const Transaction = require("../model/transactionModel");
const Wallet = require("../model/walletModel");
const Category = require("../model/categoryModel");
const { v4: uuidv4 } = require('uuid');
const financeService = require('../services/financeService');
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
    const { categoryId, type, amount, transaction_date, note } = req.body;
    try {
        const result = await financeService.createTransaction(userId, {
            wallet_id: walletId,
            category_id: categoryId,
            type,
            amount,
            transaction_date,
            note,
        });
        return res.status(201).json(result);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ message: error.message });
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

const updateTransaction = async (req, res) => {
    const transactionId = req.params.transactionId;
    const userId = req.user.id;
    const {categoryId, type, amount, transaction_date, note} = req.body;
    
    if (!type || amount === undefined || !transaction_date || !categoryId) {
        return res.status(400).json({ message: "Type, amount, transaction_date, categoryId are required!" });
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

        // Get the original transaction
        const oldTransaction = await Transaction.getTransactionById(transactionId, connection);
        if (!oldTransaction) {
            await connection.rollback();
            return res.status(404).json({ message: "Transaction not found!" });
        }

        const walletId = oldTransaction.wallet_id;
        const wallet = await Wallet.findById(walletId, connection);
        
        if (!wallet) {
            await connection.rollback();
            return res.status(404).json({ message: "Wallet not found!" });
        }
        if (wallet.user_id !== userId) {
            await connection.rollback();
            return res.status(403).json({ message: "You are not authorized to update this transaction!" });
        }

        //Check if category exists and belongs to user
        const category = await Category.findById(categoryId,connection);
        if (!category) {
            await connection.rollback();
            return res.status(404).json({ message: "Category not found!" });
        }
        if (category.user_id !== userId && category.user_id !== null) {
            await connection.rollback();
            return res.status(403).json({ message: "You are not authorized to use this category!" });
        }

        // Calculate balance differences
        // First reverse the old transaction
        const oldBalanceReversal = oldTransaction.type === 'INCOME' ? -oldTransaction.amount : oldTransaction.amount;
        
        // Then apply the new transaction
        const newBalanceChange = type === 'INCOME' ? amount : -amount;
        
        const totalBalanceChange = parseFloat(oldBalanceReversal) + parseFloat(newBalanceChange);

        // Check if wallet has enough balance (if this leads to negative balance)
        if (parseFloat(wallet.balance) + totalBalanceChange < 0) {
            await connection.rollback();
            return res.status(400).json({ message: "Not enough balance in wallet for this update!" });
        }

        await Wallet.updateBalance(walletId, totalBalanceChange, connection);

        // Update the transaction
        await Transaction.updateTransaction(transactionId, categoryId, type, amount, transaction_date, note, connection);
        
        await connection.commit();
        return res.status(200).json({ message: "Transaction updated successfully!" });
    } catch (error) {
        await connection.rollback();
        return res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};
const getTransactionsByUserId = async (req,res) => {
    const userId = req.user.id;
    try{
        const transactions = await Transaction.getAllTransactionsByUserId(userId);
        return res.status(200).json(transactions);
    }catch(error){
        return res.status(500).json({message: "Get all transactions failed!"});
    }
}

module.exports = { getAllTransactionsByWalletId, createNormalTransaction, updateTransaction, deleteTransaction, getTransactionsByUserId};