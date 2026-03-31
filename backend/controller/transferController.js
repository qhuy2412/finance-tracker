const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const Transfer = require('../model/transferModel');
const financeService = require('../services/financeService');
const transferMoney = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await financeService.createTransfer(userId, req.body);
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