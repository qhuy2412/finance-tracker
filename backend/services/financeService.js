const walletFinance = require('./walletFinance.service');
const categoryFinance = require('./categoryFinance.service');
const transactionFinance = require('./transactionFinance.service');
const transferFinance = require('./transferFinance.service');
const savingFinance = require('./savingFinance.service');
const debtFinance = require('./debtFinance.service');
const budgetFinance = require('./budgetFinance.service');

// Facade: delegate implementation to specialized smaller modules.
module.exports = {
    createWallet: (userId, params) => walletFinance.createWallet(userId, params),
    createCategory: (userId, params) => categoryFinance.createCategory(userId, params),
    createTransaction: (userId, params) => transactionFinance.createTransaction(userId, params),
    createTransfer: (userId, params) => transferFinance.createTransfer(userId, params),
    createSaving: (userId, params) => savingFinance.createSaving(userId, params),
    createDebt: (userId, params) => debtFinance.createDebt(userId, params),
    setBudget: (userId, params) => budgetFinance.setBudget(userId, params),
    getBudgetStatusByUserId: (userId) => budgetFinance.getBudgetStatusByUserId(userId),
    deleteBudget: (userId, budgetId) => budgetFinance.deleteBudget(userId, budgetId),
};
