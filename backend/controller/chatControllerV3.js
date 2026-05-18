const { v4: uuidv4 } = require('uuid');
const Chat = require('../model/chatModel');
const { processChatMessage } = require('../services/chatService');

// ─── Main Handler ─────────────────────────────────────────────────────────
const handleChatV3 = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'message is required' });
        }

        let sessionId = req.params.sessionId;

        // Guard: if frontend passes literal string "undefined" (URL interpolation bug),
        // treat it as a missing sessionId
        if (!sessionId || sessionId === 'undefined') {
            sessionId = null;
        }

        const result = await processChatMessage(userId, message, sessionId);
        return res.json({ reply: result.reply, session_id: result.sessionId });

    } catch (err) {
        if (err.status === 404) return res.status(404).json({ error: 'Session not found' });
        if (err.status === 403) return res.status(403).json({ error: 'Forbidden' });
        console.error('[ChatV3 Unhandled]', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── Session endpoints (dùng chung với V2) ────────────────────────────────
const getSessions = async (req, res) => {
    try {
        return res.json(await Chat.getSessionList(req.user.id));
    } catch (e) {
        console.error('[getSessions]', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const createSession = async (req, res) => {
    try {
        const sessionId = uuidv4();
        await Chat.createSession(sessionId, req.user.id);
        return res.status(201).json({ session_id: sessionId });
    } catch (e) {
        console.error('[createSession]', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const getMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;

        // Validate ownership trước khi trả messages — chặn IDOR
        const owner = await Chat.getSessionOwner(sessionId);
        if (!owner) return res.status(404).json({ error: 'Session not found' });
        if (owner !== userId) return res.status(403).json({ error: 'Forbidden' });

        return res.json(await Chat.getMessages(sessionId));
    } catch (e) {
        console.error('[getMessages]', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { handleChat: handleChatV3, getSessions, createSession, getMessages };
