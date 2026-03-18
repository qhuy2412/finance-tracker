import api from './api';

export const getWallets = async () => {
    const response = await api.get('/wallets');
    return response.data;
};

export const createWallet = async (data) => {
    const response = await api.post('/wallets', data);
    return response.data;
};

export const updateWallet = async (id, data) => {
    const response = await api.put(`/wallets/${id}`, data);
    return response.data;
};
