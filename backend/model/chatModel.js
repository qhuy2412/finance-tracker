const db = require("../config/db");

const Chat = {
    createSession: async () => {
        return await db.execute(
            'Insert Into chat_sessions(id,user_id) values(?,?)',[id,user_id]
        );
    },
    getLastestSession: async (user_id) => {
        const [rows] = await db.execute(
            'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
            [user_id]

        );
        return rows[0] || null;
    },
    touchSession: async (id) => {
        return await db.execute(
            'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id])
    },
    saveMessage : async (id,session_id,role,content) => {
        return await db.execute(
            'INSERT INTO chat_messages (id,session_id, role, content) VALUES (?, ?, ?)',
            [id,session_id, role, content]
        );
    },
    getMessages : async (sessionId) => {
        const [rows] = await db.execute(
            'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC Limit 50',
            [sessionId]
        );
        return rows;
    },
    getSessionList : async (userId) => {
        const [rows] = await db.execute(
            'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC Limit 10',
            [userId]
        );
        return rows;
    }
}
module.exports = Chat;