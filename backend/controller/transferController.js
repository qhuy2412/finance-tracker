const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const Transfer = require('../model/transferModel');
const financeService = require('../services/financeService');
const { logUserActivity } = require('../utils/logger');
const transferMoney = async (req, res) => {
    const userId = req.user.id;
    const { from_wallet_id, to_wallet_id, amount } = req.body;
    try {
        const result = await financeService.createTransfer(userId, req.body);

        logUserActivity(userId, 'TRANSFER_WALLET', `Chuyển khoản nội bộ số tiền: ${Number(amount).toLocaleString('vi-VN')} ₫ từ ví ${from_wallet_id} sang ví ${to_wallet_id}`, req);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ message: error.message });
    }
};
const getAllTransfers = async (req, res) => {
    const userId = req.user.id;
    try{
        const transfers = await Transfer.getAllTrasnfersByUserId(userId);
        return res.status(200).json({ 
            message: "Get all transfers successfully!",
            data: transfers
        });
    }catch(error){
        return res.status(500).json({ error: error.message });
    }
};

module.exports = { transferMoney, getAllTransfers };