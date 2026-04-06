const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

const Chat = require('../model/chatModel');
const Wallet = require('../model/walletModel');
const Category = require('../model/categoryModel');
const Transaction = require('../model/transactionModel');
const Transfer = require('../model/transferModel');
const Saving = require('../model/savingModel');
const Debt = require('../model/debtModel');
const Budget = require('../model/budgetModel');

const { buildRouterUserContent, buildSystemPrompt } = require('../utils/prompts');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const chatModel = genAI.getGenerativeModel({ model: 'gemma-3-12b-it' });
const routerModel = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

/** Chat chỉ đọc dữ liệu; mọi thao tác ghi thực hiện trong app. */
const READ_ONLY_HINT =
    'Mình chỉ có thể xem và phân tích dữ liệu tài chính của bạn trong chat. ' +
    'Để thêm, sửa hoặc xóa giao dịch, ví, ngân sách, nợ, v.v., bạn vui lòng dùng các màn hình tương ứng trong ứng dụng FinTra nhé.';

// ─── POST /chat/send ────────────────────────────────────────────────
const handleChat = async (req, res) => {
    try {
        const userId = req.user.id;
        let sessionId = req.params.sessionId;
        const { message } = req.body;

        if (!message) return res.status(400).json({ error: 'message is required' });

        // Lịch sử session (nếu có) để router hiểu tham chiếu / câu tiếp nối
        let routerHistory = [];
        if (sessionId && sessionId !== 'undefined') {
            routerHistory = await Chat.getMessages(sessionId);
        }

        // ── 1. Router: detect intent + needed tables ──────────────────
        const routerUserContent = buildRouterUserContent(message, routerHistory);
        const routerResult = await routerModel.generateContent(routerUserContent);
        const rawJson = routerResult.response.text().replace(/```json|```/g, '').trim();
        const { intent, tables: tablesRaw, direct_reply } = JSON.parse(rawJson);
        const tables = Array.isArray(tablesRaw) ? tablesRaw : [];
        const lowerMessage = (message || '').toLowerCase();
        const writeIntents = new Set(['CREATE', 'UPDATE', 'DELETE', 'TRANSFER', 'DEBT', 'SAVING']);
        // Tránh dính câu hỏi chỉ đọc (vd. "lịch sử chuyển tiền", "bao nhiêu lần chuyển")
        const looksLikeTransferCommand = /chuyển\s+tiền\s+(từ|sang|vào|giữa)|chuyển\s+giữa\s+các\s+ví/i.test(message);
        const looksLikeOtherWrite =
            /(tạo|thêm|ghi|thiết lập|đặt|mở\s+ví|mở ví|sửa|xóa|huỷ|hủy|trả\s+nợ|thanh\s+toán\s+nợ|pay)\b/.test(lowerMessage) ||
            looksLikeTransferCommand;
        const financeContext = /(ví|danh\s*mục|giao\s*dịch|ngân\s*sách|tiết\s*kiệm|nợ|chuyển|tiền)/i;
        const looksLikeFinanceWrite = looksLikeOtherWrite && financeContext.test(message);

        if (!sessionId || sessionId === 'undefined') {
            sessionId = uuidv4().trim();
            await Chat.createSession(sessionId, userId);
        }

        // ── 1.4. Yêu cầu ghi/sửa/xóa: chat chỉ đọc ──────────────────────
        if (writeIntents.has(intent) || looksLikeFinanceWrite) {
            const reply = READ_ONLY_HINT;
            await Promise.all([
                Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply),
                Chat.touchSession(sessionId),
            ]);
            return res.json({ reply, session_id: sessionId });
        }

        // ── 1.5. Fast path: non-finance / smalltalk ───────────────────
        if (intent === 'GENERAL' || tables.length === 0) {
            const reply = direct_reply || "Tôi có thể giúp gì cho bạn về tài chính hôm nay?";
            await Promise.all([
                Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply),
                Chat.touchSession(sessionId)
            ]);
            return res.json({ reply, session_id: sessionId });
        }

        // ── 2. Fetch context data in parallel ─────────────────────────
        const contextData = {};
        const contextErrors = {};
        const fetchTasks = [];

        if (tables.includes('wallets')) {
            fetchTasks.push(
                Wallet.getAllWalletsByUserId(userId)
                    .then(rows => { contextData.wallets = rows; })
                    .catch(() => { contextErrors.wallets = true; contextData.wallets = null; })
            );
        }
        if (tables.includes('categories')) {
            fetchTasks.push(
                Category.getAllCategoriesByUserId(userId)
                    .then(rows => { contextData.categories = rows; })
                    .catch(() => { contextErrors.categories = true; contextData.categories = null; })
            );
        }
        if (tables.includes('transactions')) {
            fetchTasks.push(
                Transaction.getAllTransactionsByUserId(userId)
                    .then(rows => {
                        // Giới hạn 50 giao dịch gần nhất để tránh context quá dài
                        contextData.transactions = rows.slice(0, 50);
                    })
                    .catch(() => { contextErrors.transactions = true; contextData.transactions = null; })
            );
        }
        if (tables.includes('transfers')) {
            fetchTasks.push(
                Transfer.getAllTrasnfersByUserId(userId)
                    .then(rows => { contextData.transfers = rows; })
                    .catch(() => { contextErrors.transfers = true; contextData.transfers = null; })
            );
        }
        if (tables.includes('saving_goals')) {
            fetchTasks.push(
                Saving.getAllSavingsByUserId(userId)
                    .then(rows => { contextData.saving_goals = rows; })
                    .catch(() => { contextErrors.saving_goals = true; contextData.saving_goals = null; })
            );
        }
        if (tables.includes('debts')) {
            fetchTasks.push(
                Debt.getAllDebtsByUserId(userId)
                    .then(rows => { contextData.debts = rows; })
                    .catch(() => { contextErrors.debts = true; contextData.debts = null; })
            );
        }
        if (tables.includes('budgets')) {
            fetchTasks.push(
                Budget.getBudgetStatusByUserId(userId)
                    .then(rows => { contextData.budgets = rows; })
                    .catch(() => { contextErrors.budgets = true; contextData.budgets = null; })
            );
        }

        await Promise.all(fetchTasks);

        // ── 2.5. Guard: never default to "0" if data missing/fails ─────
        // If fetch failed for any needed table, return a clear message rather than
        // letting the LLM infer zeros from missing context.
        const failedTables = Object.keys(contextErrors).filter((k) => contextErrors[k]);
        if (failedTables.length > 0) {
            const reply =
                "Mình chưa truy xuất được dữ liệu tài chính của bạn ngay lúc này, nên chưa thể trả lời chính xác. " +
                "Bạn thử lại sau vài giây nhé.";

            await Promise.all([
                Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply)
            ]);

            return res.json({ reply, session_id: sessionId });
        }

        // Nếu bảng cần cho câu hỏi đang rỗng → trả lời cố định (chat không thể ghi hộ).
        const emptyMessagesByTable = {
            wallets:
                "Mình chưa thấy bạn có ví nào trong FinTra, nên chưa thể tính tổng số dư. Bạn hãy tạo ít nhất 1 ví rồi hỏi lại nhé.",
            transactions:
                "Mình chưa thấy bạn có giao dịch nào, nên chưa thể tổng hợp chi tiêu/thu nhập. Bạn hãy thêm vài giao dịch rồi hỏi lại nhé.",
            budgets:
                "Mình chưa thấy bạn thiết lập ngân sách, nên chưa thể báo cáo ngân sách còn lại. Bạn hãy tạo ngân sách rồi hỏi lại nhé.",
            saving_goals:
                "Mình chưa thấy bạn có mục tiêu tiết kiệm nào. Bạn hãy tạo mục tiêu tiết kiệm rồi hỏi lại nhé.",
            debts:
                "Mình chưa thấy bạn có khoản nợ nào được ghi nhận. Nếu bạn muốn theo dõi nợ, hãy tạo khoản nợ rồi hỏi lại nhé.",
            transfers:
                "Mình chưa thấy bạn có giao dịch chuyển tiền nội bộ nào. Bạn hãy tạo giao dịch chuyển tiền rồi hỏi lại nhé.",
            categories:
                "Mình chưa thấy danh mục nào. Bạn hãy tạo danh mục thu/chi rồi hỏi lại nhé.",
        };

        const firstEmpty = tables.find((t) => Array.isArray(contextData[t]) && contextData[t].length === 0);
        if (firstEmpty && emptyMessagesByTable[firstEmpty]) {
            const reply = emptyMessagesByTable[firstEmpty];

            await Promise.all([
                Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply)
            ]);

            return res.json({ reply, session_id: sessionId });
        }

        // ── 3. Build MAIN prompt with context (centralized in prompts.js) ──
        const today = new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const systemPrompt = buildSystemPrompt(today, intent, contextData);

        // ── 4. Get / create session ───────────────────────────────────

        if (!sessionId) {
            sessionId = uuidv4().trim();
            await Chat.createSession(sessionId, userId);
        }
        await Chat.touchSession(sessionId);

        // ── 5. Load chat history (last 20 messages for context) ───────
        const history = await Chat.getMessages(sessionId);
        const chatHistory = history.slice(-20).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        // ── 6. Generate reply ─────────────────────────────────────────
        const chat = chatModel.startChat({
            // Use system prompt as first message; do not persist it to DB.
            history: [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: 'Tôi đã hiểu. Tôi sẽ trả lời dựa trên dữ liệu tài chính thực tế của bạn.' }] },
                ...chatHistory
            ]
        });

        const result = await chat.sendMessage(message);
        const reply = result.response.text();

        // ── 7. Persist messages ───────────────────────────────────────
        await Promise.all([
            Chat.saveMessage(uuidv4(), sessionId, 'user', message),
            Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply)
        ]);

        return res.json({ reply, session_id: sessionId });

    } catch (error) {
        console.error('Chat error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── GET /chat/sessions ───────────────────────────────────────────────
const getSessions = async (req, res) => {
    try {
        const userId = req.user.id;
        const sessions = await Chat.getSessionList(userId);
        return res.json(sessions);
    } catch (error) {
        console.error('getSessions error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── POST /chat/sessions ──────────────────────────────────────────────
const createSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = uuidv4();
        await Chat.createSession(sessionId, userId);
        return res.status(201).json({ session_id: sessionId });
    } catch (error) {
        console.error('createSession error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── GET /chat/sessions/:sessionId/messages ───────────────────────────
const getMessages = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const messages = await Chat.getMessages(sessionId);
        return res.json(messages);
    } catch (error) {
        console.error('getMessages error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { handleChat, getSessions, createSession, getMessages };