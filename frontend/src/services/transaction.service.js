import api from './api';

export const getTransactions = async (walletId) => {
    const response = await api.get(`/transactions/${walletId}`);
    return response.data;
};

export const createTransaction = async (walletId, data) => {
    const response = await api.post(`/transactions/${walletId}`, data);
    return response.data;
};

export const deleteTransaction = async (transactionId) => {
    const response = await api.delete(`/transactions/${transactionId}`);
    return response.data;
};
