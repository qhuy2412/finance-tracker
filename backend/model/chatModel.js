const db = require("../config/db");

const Chat = {
    // Tạo session mới
    createSession: async (id, userId) => {
        return await db.execute(
            'INSERT INTO chat_sessions (id, user_id) VALUES (?, ?)',
            [id, userId]
        );
    },

    // Lấy session mới nhất của user
    getLatestSession: async (userId) => {
        const [rows] = await db.execute(
            'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
            [userId]
        );
        return rows[0] || null;
    },

    // Kiểm tra session có thuộc về userId không (dùng để chặn IDOR)
    getSessionOwner: async (sessionId) => {
        const [rows] = await db.execute(
            'SELECT user_id FROM chat_sessions WHERE id = ? LIMIT 1',
            [sessionId]
        );
        return rows[0]?.user_id || null;
    },

    // Trade-off: both queries run in parallel via Promise.all.
    // If sessionId is invalid, the messages query wastes 1 DB round-trip returning [].
    // Accepted: invalid sessionId is rare (~0% of normal traffic); parallel approach
    // saves latency on the happy path (valid session) which is ~99% of requests.
    getSessionWithMessages: async (sessionId) => {
        const [[sessionRows], [msgRows]] = await Promise.all([
            db.execute(
                'SELECT user_id FROM chat_sessions WHERE id = ? LIMIT 1',
                [sessionId]
            ),
            db.execute(
                "SELECT role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC, FIELD(role,'user','assistant') ASC LIMIT 50",
                [sessionId]
            ),
        ]);
        return {
            owner: sessionRows[0]?.user_id || null,
            messages: msgRows,
        };
    },

    // Cập nhật timestamp session
    touchSession: async (id) => {
        return await db.execute(
            'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );
    },

    // Lưu 1 tin nhắn (user hoặc assistant)
    saveMessage: async (id, sessionId, role, content) => {
        return await db.execute(
            'INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
            [id, sessionId, role, content]
        );
    },

    // Lấy tất cả tin nhắn của 1 session (tối đa 50)
    getMessages: async (sessionId) => {
        const [rows] = await db.execute(
            // created_at có thể trùng nhau (độ phân giải theo giây) vì lưu user+assistant gần như đồng thời.
            // Khi trùng timestamp, luôn ưu tiên user trước assistant để tránh đảo thứ tự khi load lại.
            "SELECT role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC, FIELD(role,'user','assistant') ASC LIMIT 50",
            [sessionId]
        );
        return rows;
    },

    // Lấy danh sách sessions của user (tối đa 10 gần nhất)
    getSessionList: async (userId) => {
        const [rows] = await db.execute(
            'SELECT id, title, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 10',
            [userId]
        );
        return rows;
    }
};

module.exports = Chat;