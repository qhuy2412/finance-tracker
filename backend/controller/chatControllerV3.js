const { v4: uuidv4 } = require('uuid');
const Chat = require('../model/chatModel');
const { runAgentLoop } = require('../services/agentServiceV3');
const financeService = require('../services/financeService');
const { sanitizeHistoryLine } = require('../utils/promptsV2');

// ─── Pending transaction store (In-memory) ────────────────────────────────
// Cấu trúc: Map<sessionId, { data: TransactionArgs, createdAt: number }>
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 phút
const pendingActions = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [sid, entry] of pendingActions.entries()) {
        if (now - entry.createdAt > PENDING_TTL_MS) pendingActions.delete(sid);
    }
}, 5 * 60 * 1000);

// ─── Helpers ──────────────────────────────────────────────────────────────
const isConfirm = (text) => {
    const t = (text || '').trim();
    // Chỉ dùng exact-match để tránh false positive
    // (VD: "Bạn có đồng ý rằng tôi nên tiết kiệm không?" không được xác nhận làm giao dịch)
    return /^(đồng ý|ok|okay|xác nhận|confirm|làm luôn|thực hiện|chuẩn|chuẩn rồi|ôk|được rồi|đúng|đúng rồi|chính xác|có|được)$/i.test(t);
};

const isCancel = (text) => {
    const t = (text || '').trim();
    // Flag `i` trong regex đủ xử lý case-insensitive — không cần .toLowerCase()
    return /^(hủy|huỷ|không|từ chối|cancel|ko|stop)$/i.test(t) || /^(hủy|huỷ|cancel|stop)\b/i.test(t);
};

const formatTransactionConfirmText = (data) =>
    `Bạn xác nhận thông tin sau:\n` +
    `- Loại: ${data.type === 'EXPENSE' ? 'Chi tiêu' : 'Thu nhập'}\n` +
    `- Số tiền: ${Number(data.amount).toLocaleString('vi-VN')} đ\n` +
    `- Ví: "${data.wallet_name}"\n` +
    `- Danh mục: "${data.category_name}"\n` +
    `- Ngày: ${data.date}\n` +
    `${data.note ? `- Ghi chú: ${data.note}\n` : ''}` +
    `\nTrả lời "Đồng ý" để lưu hoặc "Hủy" để bỏ qua.`;

const formatTransactionErrorVi = (msg) => {
    const m = String(msg || '');
    if (/Wallet not found/i.test(m)) return 'Không tìm thấy ví theo tên đã chọn.';
    if (/Category not found/i.test(m)) return 'Không tìm thấy danh mục theo tên đã chọn.';
    if (/Not enough balance/i.test(m)) return 'Số dư ví không đủ cho khoản chi này.';
    if (/must be either INCOME or EXPENSE/i.test(m)) return 'Loại giao dịch không hợp lệ.';
    if (/Amount must be a positive number/i.test(m)) return 'Số tiền phải là số dương.';
    return 'Không thể tạo giao dịch. Vui lòng thử lại.';
};

// ─── Chuyển đổi lịch sử từ DB sang định dạng Google GenAI ─────────────────
// Google GenAI yêu cầu history là mảng { role: 'user'|'model', parts: [{ text }] }
const buildGenAIHistory = (messages) =>
    messages
        .slice(-14) // giữ 7 lượt gần nhất
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: sanitizeHistoryLine(m.content) }],
        }));

// ─── Main Handler ─────────────────────────────────────────────────────────
const handleChatV3 = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'message is required' });
        }

        let sessionId = req.params.sessionId;
        let dbMessages = [];

        if (!sessionId || sessionId === 'undefined') {
            sessionId = uuidv4();
            await Chat.createSession(sessionId, userId);
        } else {
            // Fix #1: getSessionWithMessages gộp ownership check + fetch messages vào 1 round-trip
            // Thay vì gọi getSessionOwner + getMessages riêng (2 sequential DB calls)
            const { owner, messages } = await Chat.getSessionWithMessages(sessionId);
            if (!owner) {
                return res.status(404).json({ error: 'Session not found' });
            }
            if (owner !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            dbMessages = messages;
        }

        // Lưu chat và trả response — ghi DB bất đồng bộ (fire-and-forget)
        const sendReply = (reply) => {
            Promise.all([
                Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply),
                Chat.touchSession(sessionId),
            ]).catch(e => console.error('[ChatV3] Save failed:', e));
            return res.json({ reply, session_id: sessionId });
        };

        // ── Bước 1: Kiểm tra pending transaction ──────────────────────────
        const pending = pendingActions.get(sessionId);
        if (pending) {
            if (Date.now() - pending.createdAt > PENDING_TTL_MS) {
                pendingActions.delete(sessionId);
                // Hết hạn → tiếp tục xử lý tin nhắn như bình thường
            } else if (isCancel(message)) {
                pendingActions.delete(sessionId);
                return sendReply('Mình đã hủy thao tác lưu giao dịch.');
            } else if (isConfirm(message)) {
                pendingActions.delete(sessionId);
                try {
                    await financeService.createTransaction(userId, {
                        wallet_name:      pending.data.wallet_name,
                        category_name:    pending.data.category_name,
                        type:             pending.data.type,
                        amount:           pending.data.amount,
                        transaction_date: pending.data.date,
                        note:             pending.data.note || '',
                    });
                    return sendReply('Đã ghi giao dịch thành công nhé! 🎉');
                } catch (e) {
                    return sendReply(formatTransactionErrorVi(e.message));
                }
            } else {
                // User nhắn tin mới → hủy pending cũ và tiếp tục xử lý
                pendingActions.delete(sessionId);
            }
        }

        // ── Bước 2: Chạy Agent Loop với lịch sử đã fetch ở trên ──────────
        const genAIHistory = buildGenAIHistory(dbMessages);
        const agentResult = await runAgentLoop(userId, message.trim(), genAIHistory);

        // ── Bước 3: Xử lý kết quả từ Agent ───────────────────────────────
        switch (agentResult.type) {
            case 'FINAL_ANSWER':
                return sendReply(agentResult.payload);

            case 'CLARIFICATION':
                // Agent muốn hỏi lại người dùng — gửi câu hỏi trực tiếp
                return sendReply(agentResult.payload);

            case 'PENDING_TRANSACTION': {
                // Agent đề xuất tạo giao dịch — lưu vào store và hỏi xác nhận
                const txData = agentResult.payload;
                pendingActions.set(sessionId, { data: txData, createdAt: Date.now() });
                return sendReply(formatTransactionConfirmText(txData));
            }

            case 'ERROR':
            default:
                return sendReply(agentResult.payload || 'Có lỗi xảy ra. Vui lòng thử lại.');
        }

    } catch (err) {
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
