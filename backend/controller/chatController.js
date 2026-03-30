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

const { ROUTER_PROMPT } = require('../utils/prompts');


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const routerModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const chatModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

// ─── POST /chat/send ────────────────────────────────────────────────
const handleChat = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message, session_id } = req.body;

        if (!message) return res.status(400).json({ error: 'message is required' });

        // ── 1. Router: detect intent + needed tables ──────────────────
        const routerResult = await routerModel.generateContent(
            `${ROUTER_PROMPT}\nCâu chat: "${message}"`
        );
        const rawJson = routerResult.response.text().replace(/```json|```/g, '').trim();
        const { intent, tables } = JSON.parse(rawJson);

        // ── 2. Fetch context data in parallel ─────────────────────────
        const contextData = {};
        const fetchTasks = [];

        if (tables.includes('wallets')) {
            fetchTasks.push(
                Wallet.getAllWalletsByUserId(userId)
                    .then(rows => { contextData.wallets = rows; })
            );
        }
        if (tables.includes('categories')) {
            fetchTasks.push(
                Category.getAllCategoriesByUserId(userId)
                    .then(rows => { contextData.categories = rows; })
            );
        }
        if (tables.includes('transactions')) {
            fetchTasks.push(
                Transaction.getAllTransactionsByUserId(userId)
                    .then(rows => {
                        // Giới hạn 50 giao dịch gần nhất để tránh context quá dài
                        contextData.transactions = rows.slice(0, 50);
                    })
            );
        }
        if (tables.includes('transfers')) {
            fetchTasks.push(
                Transfer.getAllTrasnfersByUserId(userId)
                    .then(rows => { contextData.transfers = rows; })
            );
        }
        if (tables.includes('saving_goals')) {
            fetchTasks.push(
                Saving.getAllSavingsByUserId(userId)
                    .then(rows => { contextData.saving_goals = rows; })
            );
        }
        if (tables.includes('debts')) {
            fetchTasks.push(
                Debt.getAllDebtsByUserId(userId)
                    .then(rows => { contextData.debts = rows; })
            );
        }
        if (tables.includes('budgets')) {
            fetchTasks.push(
                Budget.getBudgetStatusByUserId(userId)
                    .then(rows => { contextData.budgets = rows; })
            );
        }

        await Promise.all(fetchTasks);

        // ── 3. Build MAIN prompt with context ─────────────────────────
        const today = new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const systemPrompt = `
Bạn là trợ lý tài chính thông minh của ứng dụng FinTra.
Hôm nay là: ${today}.
Người dùng đang hỏi với intent: "${intent}".

DỮ LIỆU TÀI CHÍNH HIỆN TẠI CỦA NGƯỜI DÙNG:
${JSON.stringify(contextData, null, 2)}

HƯỚNG DẪN TRẢ LỜI:
- Trả lời bằng tiếng Việt, thân thiện và ngắn gọn.
- Dùng số liệu thực từ dữ liệu trên để trả lời chính xác.
- Format số tiền theo kiểu: 1.500.000 đ
- Nếu không có dữ liệu liên quan, hãy nói rõ và gợi ý người dùng tạo dữ liệu.
- Không bịa đặt số liệu.`;

        // ── 4. Get / create session ───────────────────────────────────
        let sessionId = session_id;

        if (!sessionId) {
            sessionId = uuidv4();
            await Chat.createSession(sessionId, userId);
        } else {
            await Chat.touchSession(sessionId);
        }

        // ── 5. Load chat history (last 20 messages for context) ───────
        const history = await Chat.getMessages(sessionId);
        const chatHistory = history.slice(-20).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        // ── 6. Generate reply ─────────────────────────────────────────
        const chat = chatModel.startChat({
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