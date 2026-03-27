import api from './api';
const chatService = {
    createSession: () => api.post('/chat/sessions',{}),
    getSession: () => api.get('/chat/sessions'),
    getMessage: (sessionId) => api.get(`/chat/sessions/${sessionId}/messages`),
    sendMessage: (message, sessionId) => api.post('/chat/send', { message, session_id: sessionId })
}
export default chatService;