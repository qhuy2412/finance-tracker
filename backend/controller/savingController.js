const { v4: uuidv4 } = require('uuid');
const Saving = require('../model/savingModel');
const Wallet = require('../model/walletModel');
const financeService = require('../services/financeService');

const createSaving = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await financeService.createSaving(userId, req.body);
        return res.status(201).json(result);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ message: error.message });
    }
};

const getAllSavings = async (req, res) => {
    const userId = req.user.id;
    try {
        const savings = await Saving.getAllSavingsByUserId(userId);
        res.status(200).json(savings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteSaving = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        await Saving.deleteSaving(id, userId);
        res.status(200).json({ message: "Xóa mục tiêu tiết kiệm thành công!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Nạp tiền: ghi saving_transaction DEPOSIT, cập nhật current_amount
const depositSaving = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { add_amount, wallet_id, note } = req.body;

    try {
        const goal = await Saving.getSavingById(id, userId);
        if (!goal) return res.status(404).json({ message: "Không tìm thấy mục tiêu tiết kiệm!" });
        if (goal.status === 'COMPLETED') return res.status(400).json({ message: "Mục tiêu này đã hoàn thành rồi!" });
        if (!add_amount || Number(add_amount) <= 0) return res.status(400).json({ message: "Số tiền phải lớn hơn 0!" });
        if (!wallet_id) return res.status(400).json({ message: "Vui lòng chọn ví nguồn!" });

        const remaining = Number(goal.target_amount) - Number(goal.current_amount);
        if (Number(add_amount) > remaining) {
            return res.status(400).json({ message: `Chỉ cần thêm ${remaining.toLocaleString('vi-VN')} ₫ để hoàn thành mục tiêu!` });
        }

        // Kiểm tra số dư khả dụng của ví (balance - tổng đang reserved sang savings khác)
        const wallet = await Wallet.findById(wallet_id);
        if (!wallet || wallet.user_id !== userId) {
            return res.status(404).json({ message: "Không tìm thấy ví!" });
        }
        const reservedRows = await Saving.getReservedAmountPerWallet(userId);
        const reservedForWallet = reservedRows.find(r => r.wallet_id === wallet_id);
        const currentReserved = reservedForWallet ? Number(reservedForWallet.reserved) : 0;
        const available = Number(wallet.balance) - currentReserved;
        if (Number(add_amount) > available) {
            return res.status(400).json({
                message: `Số dư khả dụng của ví không đủ! Khả dụng: ${available.toLocaleString('vi-VN')} ₫ (Tổng: ${Number(wallet.balance).toLocaleString('vi-VN')} ₫ - Đang tiết kiệm: ${currentReserved.toLocaleString('vi-VN')} ₫).`
            });
        }

        const newAmount = Number(goal.current_amount) + Number(add_amount);
        const status = newAmount >= Number(goal.target_amount) ? 'COMPLETED' : 'IN_PROGRESS';

        await Saving.createSavingTransaction(uuidv4(), id, wallet_id, 'DEPOSIT', Number(add_amount), note || null);
        await Saving.updateCurrentAmount(id, newAmount, status);

        res.status(200).json({ message: "Nạp tiền thành công!", current_amount: newAmount, status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Rút tiền: ghi saving_transaction WITHDRAW, cập nhật current_amount
const withdrawSaving = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { withdraw_amount, wallet_id, note } = req.body;

    try {
        const goal = await Saving.getSavingById(id, userId);
        if (!goal) return res.status(404).json({ message: "Không tìm thấy mục tiêu tiết kiệm!" });
        if (!withdraw_amount || Number(withdraw_amount) <= 0) return res.status(400).json({ message: "Số tiền phải lớn hơn 0!" });
        if (!wallet_id) return res.status(400).json({ message: "Vui lòng chọn ví nhận!" });
        if (Number(withdraw_amount) > Number(goal.current_amount)) {
            return res.status(400).json({ message: "Số tiền rút không được lớn hơn số tiền hiện có trong mục tiêu!" });
        }

        const newAmount = Number(goal.current_amount) - Number(withdraw_amount);
        const status = newAmount >= Number(goal.target_amount) ? 'COMPLETED' : 'IN_PROGRESS';

        await Saving.createSavingTransaction(uuidv4(), id, wallet_id, 'WITHDRAW', Number(withdraw_amount), note || null);
        await Saving.updateCurrentAmount(id, newAmount, status);

        res.status(200).json({ message: "Rút tiền thành công!", current_amount: newAmount, status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Lịch sử nạp/rút của 1 mục tiêu
const getSavingHistory = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const goal = await Saving.getSavingById(id, userId);
        if (!goal) return res.status(404).json({ message: "Không tìm thấy mục tiêu!" });
        const history = await Saving.getSavingTransactions(id);
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Map wallet_id → số tiền đang "khóa" trong savings
const getReservedByWallet = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await Saving.getReservedAmountPerWallet(userId);
        const reservedMap = {};
        rows.forEach(r => { reservedMap[r.wallet_id] = Number(r.reserved); });
        res.status(200).json(reservedMap);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { createSaving, getAllSavings, deleteSaving, depositSaving, withdrawSaving, getSavingHistory, getReservedByWallet };