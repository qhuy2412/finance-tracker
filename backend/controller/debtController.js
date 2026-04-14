const db = require('../config/db');
const Debt = require("../model/debtModel");
const { v4: uuidv4 } = require('uuid');
const financeService = require('../services/financeService');
const Saving = require('../model/savingModel');

const getAllDebts = async (req, res) => {
    try {
        const userId = req.user.id;
        const debts = await Debt.getAllDebtsByUserId(userId);
        return res.status(200).json(debts);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
const createDebt = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await financeService.createDebt(userId, req.body);
        return res.status(201).json(result);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ message: error.message });
    }
};
const payDebt = async (req, res) => {
    const debtId = req.params.debtId;
    const userId = req.user.id;
    const { wallet_id, pay_amount, transaction_date, note } = req.body;
    console.log(req.body);
    // Validation input
    if (!wallet_id || !pay_amount || !transaction_date) {
        return res.status(400).json({ message: "wallet_id, pay amount , transaction_date is required!" });
    }
    if (pay_amount <= 0) {
        return res.status(400).json({ message: "Pay amount must be greater than 0!" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [debts] = await connection.execute(
            'SELECT * FROM debts WHERE id = ? AND user_id = ? FOR UPDATE',
            [debtId, userId]
        );
        const debt = debts[0];
        if (!debt) {
            await connection.rollback();
            return res.status(400).json({ message: "Debt not found or you are unauthorized!" })
        }
        if (debt.status === 'PAID') {
            await connection.rollback();
            return res.status(400).json({ message: "Debt is paid!" });
        }
        const remaining_amount = parseFloat(debt.amount) - parseFloat(debt.paid_amount);
        if (pay_amount > remaining_amount) {
            await connection.rollback();
            return res.status(400).json({ message: "You are paying amount greater than this debt" });
        }
        const [wallets] = await connection.execute(
            'SELECT * FROM wallets WHERE id = ? AND user_id = ? FOR UPDATE',
            [wallet_id, userId]
        );
        const wallet = wallets[0];
        if (debt.type === 'BORROW') {
            const reservedRows = await Saving.getReservedAmountPerWallet(userId);
            const reservedEntry = reservedRows.find(r => r.wallet_id === wallet_id);
            const reservedAmount = reservedEntry ? Number(reservedEntry.reserved) : 0;
            const availableBalance = Number(wallet.balance) - reservedAmount;

            if (availableBalance < pay_amount) {
                await connection.rollback();
                return res.status(400).json({ message: `Số dư khả dụng của ví không đủ để thanh toán nợ! Khả dụng: ${availableBalance.toLocaleString('vi-VN')} ₫ (tổng ${Number(wallet.balance).toLocaleString('vi-VN')} ₫ - đang tiết kiệm ${reservedAmount.toLocaleString('vi-VN')} ₫).` });
            }
        }
        // Update balance of wallet
        const balanceChange = debt.type === 'BORROW' ? -pay_amount : pay_amount;
        await connection.execute(
            'UPDATE wallets SET balance = balance + ? WHERE id = ?',
            [balanceChange, wallet_id]
        );
        // Update new balance for debt
        const newPaidAmount = parseFloat(debt.paid_amount) + parseFloat(pay_amount);
        const newStatus = newPaidAmount >= parseFloat(debt.amount) ? 'PAID' : 'UNPAID';
        await connection.execute(
            'UPDATE debts SET paid_amount = ? , status = ? WHERE id = ?',
            [newPaidAmount, newStatus, debtId]
        );
        const transactionId = uuidv4().trim();
        const transType = debt.type === 'BORROW' ? 'DEBT_OUT' : 'DEBT_IN';
        await connection.execute(
            `INSERT INTO transactions
            (id, user_id, wallet_id, debt_id, type, amount, transaction_date, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [transactionId, userId, wallet_id, debtId, transType, pay_amount, transaction_date, note || '']
        );
        await connection.commit();
        return res.status(200).json({
            message: "Thanh toán nợ thành công!",
            data: {
                paid: pay_amount,
                remaining: parseFloat(debt.amount) - newPaidAmount,
                status: newStatus
            }
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};
const deleteDebt = async (req, res) => {
    const debtId = req.params.debtId;
    const userId = req.user.id;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [debts] = await connection.execute(
            'SELECT * FROM debts WHERE id = ? AND user_id = ? FOR UPDATE',
            [debtId, userId]
        );
        const debt = debts[0];

        if (!debt) {
            throw new Error("Debt not found or you are unauthorized!");
        }
        if (parseFloat(debt.paid_amount) > 0) {
            throw new Error("Cannot delete! This debt has payment transactions. Please delete the payment history first.");
        }

        const amount = parseFloat(debt.amount);
        const paidAmount = parseFloat(debt.paid_amount);
        let balanceChange = 0;

        if (debt.type === 'BORROW') {
            balanceChange = paidAmount - amount;
        } else if (debt.type === 'LEND') {
            balanceChange = amount - paidAmount;
        }
        
        if (balanceChange < 0) {
            const reservedRows = await Saving.getReservedAmountPerWallet(userId);
            const reservedEntry = reservedRows.find(r => r.wallet_id === debt.wallet_id);
            const reservedAmount = reservedEntry ? Number(reservedEntry.reserved) : 0;
            const availableBalance = Number(debt.wallet_balance || 0); // we need to query wallet balance!
            
            // let's fetch wallet balance just to be safe
            const [wallets] = await connection.execute(
                'SELECT balance FROM wallets WHERE id = ? FOR UPDATE',
                [debt.wallet_id]
            );
            const walletBalance = wallets.length ? Number(wallets[0].balance) : 0;
            const currentAvailable = walletBalance - reservedAmount;

            if (currentAvailable + balanceChange < 0) {
                throw new Error(`Không thể xoá! Số dư khả dụng của ví sẽ xuống âm. Khả dụng: ${currentAvailable.toLocaleString('vi-VN')} ₫ (tổng ${walletBalance.toLocaleString('vi-VN')} ₫ - đang tiết kiệm ${reservedAmount.toLocaleString('vi-VN')} ₫).`);
            }
        }

        await connection.execute(
            'UPDATE wallets SET balance = balance + ? WHERE id = ?',
            [balanceChange, debt.wallet_id]
        );

        await connection.execute(
            'DELETE FROM debts WHERE id = ?',
            [debtId]
        );

        await connection.commit();

        return res.status(200).json({
            message: "Debt deleted and wallet balance updated successfully!",
            data: {
                deleted_debt_id: debtId,
                wallet_refunded: balanceChange
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

module.exports = { getAllDebts, createDebt, payDebt, deleteDebt };