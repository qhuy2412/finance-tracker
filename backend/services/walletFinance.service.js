const { v4: uuidv4 } = require('uuid');
const Wallet = require('../model/walletModel');
const { createHttpError } = require('./financeErrors');

const walletFinance = {
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
};

module.exports = walletFinance;

