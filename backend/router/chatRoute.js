const express = require('express');
const router = express.Router();
const { handleChat, getSessions, createSession, getMessages } = require('../controller/chatController');
const authMiddleware = require('../middleware/authMiddleware');

// All chat routes require authentication
router.use(authMiddleware);

router.get('/sessions', getSessions);                           // GET  /api/chat/sessions
router.post('/sessions', createSession);                        // POST /api/chat/sessions
router.get('/sessions/:sessionId/messages', getMessages);       // GET  /api/chat/sessions/:sessionId/messages
router.post('/sessions/:sessionId/messages', handleChat);       // POST /api/chat/sessions/:sessionId/messages
module.exports = router;
