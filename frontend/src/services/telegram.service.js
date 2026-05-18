import api from './api';

const telegramService = {
    generateLinkToken: () =>
        api.post('/telegram/generate-link-token'),

    getLinkStatus: () =>
        api.get('/telegram/status'),

    unlinkAccount: () =>
        api.delete('/telegram/unlink'),
};

export default telegramService;
