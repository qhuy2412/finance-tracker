const Wallet = require('../model/walletModel');
const Category = require('../model/categoryModel');
const { createHttpError } = require('./financeErrors');

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

module.exports = { resolveWalletId, resolveCategoryId };

