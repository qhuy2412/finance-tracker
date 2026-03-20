import api from './api';

export const getDebts = async () => {
    const response = await api.get('/debts');
    return response.data;
};

export const createDebt = async (data) => {
    const response = await api.post('/debts', data);
    return response.data;
};

export const deleteDebt = async (debtId) => {
    const response = await api.delete(`/debts/${debtId}`);
    return response.data;
};

export const payDebt = async (debtId, data) => {
    const response = await api.post(`/debts/${debtId}/pay`, data);
    return response.data;
};
