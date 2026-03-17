const db = require("../config/db");
const Wallet = require("../model/walletModel");
const { v4: uuidv4 } = require('uuid');

const getAllWallets = async (req, res) => {
    try {
        const userId = req.user.id;
        const wallets = await Wallet.getAllWalletsByUserId(userId);
        return res.status(200).json(wallets);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
const createWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, type, balance } = req.body;
        if (!name || !type || balance === undefined) {
            return res.status(400).json({ message: "Name, type, and balance are required!" });
        }
        if (balance < 0) {
            return res.status(400).json({ message: "Balance must be a positive number!" });
        }
        const existingWallet = await Wallet.findByName(userId, name);
        if (existingWallet) {
            return res.status(400).json({ message: "Wallet name already exists!" });
        }
        const walletId = uuidv4().trim();
        await Wallet.createWallet(walletId, userId, name, type, balance);
        return res.status(201).json({ message: "Wallet created successfully!" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
const updateWallet = async (req, res) => {
    try {
        const walletId = req.params.id;
        const userId = req.user.id;
        const { name, type, balance } = req.body;
        const wallet = await Wallet.findById(walletId);
        if (!wallet) {
            return res.status(404).json({ message: "Wallet not found!" });
        }
        if (wallet.user_id !== userId) {
            return res.status(403).json({ message: "You are not authorized to update this wallet!" });
        }
        if (!name || !type || balance === undefined) {
            return res.status(400).json({ message: "Name, type, and balance are required!" });
        }
        if (balance < 0) {
            return res.status(400).json({ message: "Balance must be a positive number!" });
        }
        if (name !== wallet.name) {
            const existingWallet = await Wallet.findByName(userId, name);
            if (existingWallet) {
                return res.status(400).json({ message: "Wallet name already exists!" });
            }
        }
        await Wallet.updateWallet(walletId, name, type, balance);
        return res.status(200).json({ message: "Wallet updated successfully!" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { getAllWallets, createWallet, updateWallet };