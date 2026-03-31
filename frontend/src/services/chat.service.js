import api from './api';
const chatService = {
    createSession: () => api.post('/chat/sessions', {}),
    getSessions: () => api.get('/chat/sessions').then((r) => r.data),
    getMessages: (sessionId) =>
        api.get(`/chat/sessions/${sessionId}/messages`).then((r) => r.data),
    sendMessage: (message, sessionId) =>
        api
            .post(`/chat/sessions/${sessionId}/messages`, { message })
            .then((r) => r.data),
}
export default chatService;