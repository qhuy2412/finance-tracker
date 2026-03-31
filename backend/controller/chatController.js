const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/db');

const Chat = require('../model/chatModel');
const Wallet = require('../model/walletModel');
const Category = require('../model/categoryModel');
const Transaction = require('../model/transactionModel');
const Transfer = require('../model/transferModel');
const Saving = require('../model/savingModel');
const Debt = require('../model/debtModel');
const Budget = require('../model/budgetModel');

const { ROUTER_PROMPT, buildSystemPrompt, buildToolProposalPrompt } = require('../utils/prompts');
const financeService = require('../services/financeService');


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const routerModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Pending tool proposals per chat session (in-memory). Cleared after confirm/cancel or TTL.
const pendingActions = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes

const isConfirm = (text) => {
    const t = (text || '').toLowerCase().trim();
    return /^(đồng ý|ok|okay|xác nhận|confirm|làm luôn|làm tiếp|thực hiện|chuẩn|được rồi|được|có)$/i.test(t) ||
        t.includes('đồng ý') ||
        t.includes('xác nhận') ||
        t.includes('làm luôn') ||
        t.includes('thực hiện');
};

const isCancel = (text) => {
    const t = (text || '').toLowerCase().trim();
    return /^(hủy|huỷ|không|từ chối|cancel|ko|stop)$/i.test(t) ||
        t.includes('hủy') ||
        t.includes('huỷ') ||
        t.includes('không');
};

const resolveWalletId = async (userId, params) => {
    if (params.wallet_id) return params.wallet_id;
    if (params.wallet_name) {
        const w = await Wallet.findByName(userId, params.wallet_name);
        if (!w) throw new Error(`Wallet not found: ${params.wallet_name}`);
        return w.id;
    }
    throw new Error('Missing wallet_id/wallet_name');
};

const resolveCategoryId = async (userId, params) => {
    if (params.category_id) return params.category_id;
    if (params.category_name) {
        const c = await Category.findByName(userId, params.category_name);
        if (!c) throw new Error(`Category not found: ${params.category_name}`);
        return c.id;
    }
    throw new Error('Missing category_id/category_name');
};

const executeTool = async (userId, tool, params) => {
    if (!tool) throw new Error('Missing tool');
    if (!params) throw new Error('Missing params');

    switch (tool) {
        case 'wallets.create': {
            const result = await financeService.createWallet(userId, params);
            return { ok: true, reply: result.message };
        }

        case 'categories.create': {
            const result = await financeService.createCategory(userId, params);
            return { ok: true, reply: result.message };
        }

        case 'transactions.create': {
            const result = await financeService.createTransaction(userId, params);
            return { ok: true, reply: result.message };
        }

        case 'transfers.create': {
            const result = await financeService.createTransfer(userId, params);
            return { ok: true, reply: result.message };
        }

        case 'savings.create': {
            const result = await financeService.createSaving(userId, params);
            return { ok: true, reply: result.message };
        }

        case 'debts.create': {
            const result = await financeService.createDebt(userId, params);
            return { ok: true, reply: result.message };
        }

        case 'budgets.set': {
            const result = await financeService.setBudget(userId, params);
            return { ok: true, reply: result.message };
        }

        default:
            throw new Error(`Unsupported tool: ${tool}`);
    }
};

// ─── POST /chat/send ────────────────────────────────────────────────
const handleChat = async (req, res) => {
    try {
        const userId = req.user.id;
        let sessionId = req.params.sessionId;
        const { message } = req.body;

        if (!message) return res.status(400).json({ error: 'message is required' });

        // ── 1. Router: detect intent + needed tables ──────────────────
        const routerResult = await routerModel.generateContent(
            `${ROUTER_PROMPT}\nCâu chat: "${message}"`
        );
        const rawJson = routerResult.response.text().replace(/```json|```/g, '').trim();
        const { intent, tables: tablesRaw, direct_reply } = JSON.parse(rawJson);
        const tables = Array.isArray(tablesRaw) ? tablesRaw : [];
        let isWriteIntent = ['CREATE', 'UPDATE', 'DELETE', 'TRANSFER', 'DEBT', 'SAVING'].includes(intent);
        const lowerMessage = (message || '').toLowerCase();
        const writeKeywords = /(tạo|thêm|ghi|chuyển|thiết lập|đặt|mở\s+ví|mở ví|sửa|xóa|huỷ|hủy|trả\s+nợ|thanh\s+toán\s+nợ|pay)\b/;
        const financeKeywords = /(ví|danh\s*mục|giao\s*dịch|ngân\s*sách|tiết\s*kiệm|nợ|chuyển\s*tiền|chuyển)\b/;
        if (writeKeywords.test(lowerMessage) && financeKeywords.test(lowerMessage)) {
            isWriteIntent = true;
        }

        if (!sessionId || sessionId === 'undefined') {
            sessionId = uuidv4().trim();
            await Chat.createSession(sessionId, userId);
        }

        // ── 1.4. If we have a pending action, try confirm/cancel ─────────
        const pending = pendingActions.get(sessionId);
        if (pending) {
            if (Date.now() - pending.createdAt > PENDING_TTL_MS) {
                pendingActions.delete(sessionId);
            } else if (isCancel(message)) {
                pendingActions.delete(sessionId);
                const reply = "Mình đã hủy thao tác theo yêu cầu của bạn.";
                await Promise.all([
                    Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                    Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply),
                ]);
                return res.json({ reply, session_id: sessionId });
            } else if (isConfirm(message)) {
                try {
                    pendingActions.delete(sessionId);
                    const exec = await executeTool(userId, pending.tool, pending.params);
                    const reply = exec?.reply || "Mình đã thực hiện thao tác thành công.";
                    await Promise.all([
                        Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                        Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply),
                    ]);
                    return res.json({ reply, session_id: sessionId });
                } catch (e) {
                    pendingActions.delete(sessionId);
                    const reply = `Không thể thực hiện thao tác do lỗi: ${e.message || 'unknown error'}`;
                    await Promise.all([
                        Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                        Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply),
                    ]);
                    return res.json({ reply, session_id: sessionId });
                }
            } else {
                // User replied something else; clear pending to avoid executing an outdated proposal.
                pendingActions.delete(sessionId);
            }
        }

        // ── 1.5. Fast path: non-finance / smalltalk ───────────────────
        // Router prompt already instructs: "không liên quan đến tài chính" → empty array.
        // In that case, reply directly with router model to reduce latency/cost.
        if (intent === 'GENERAL' || (tables.length === 0 && !isWriteIntent)) {
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

        // If fetch succeeded but the user has no data yet, reply deterministically.
        // However, for "create/add" requests (e.g. "tạo ví", "tạo danh mục", ...), we should not
        // block the user with "you have no data" messages.
        // lowerMessage đã được khai báo ở đầu hàm (dùng cho wantsToCreateForTable).
        const wantsToCreateForTable = (table) => {
            const createMatchers = {
                wallets: [/tạo\s+ví/, /thêm\s+ví/, /mở\s+ví/],
                categories: [/tạo\s+danh\s*mục/, /thêm\s+danh\s*mục/],
                budgets: [/tạo\s+ngân\s*sách/, /thêm\s+ngân\s*sách/, /thiết\s*lập\s+ngân\s*sách/],
                saving_goals: [/tạo\s+mục\s+tiêu/, /thêm\s+mục\s+tiêu/, /mục\s+tiêu\s+tiết\s+kiệm/],
                debts: [/tạo\s+nợ/, /thêm\s+nợ/, /\bvay\b/, /cho\s+vay/, /cho\s+nợ/],
                // transactions/transfers usually require existing wallets/categories to execute,
                // so we do not bypass empty-data replies for these tables.
                transactions: [],
                transfers: [],
            };

            const matchers = createMatchers[table] || [];
            return matchers.some((re) => re.test(lowerMessage));
        };

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
            // If user is explicitly trying to create that kind of data, let the LLM guide them
            // instead of returning an "all your data is empty" message.
            if (wantsToCreateForTable(firstEmpty)) {
                // Continue to main flow.
            } else {
                const reply = emptyMessagesByTable[firstEmpty];

                await Promise.all([
                    Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                    Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply)
                ]);

                return res.json({ reply, session_id: sessionId });
            }
        }

        // ── 2.6. Write intent: đề xuất tool + hỏi xác nhận ─────────────
        if (isWriteIntent) {
            try {
                const proposalPrompt = buildToolProposalPrompt(message, intent, tables, contextData);
                const proposalResult = await chatModel.generateContent(proposalPrompt);
                const rawProposal = proposalResult.response.text().replace(/```json|```/g, '').trim();
                const proposal = JSON.parse(rawProposal);

                const missing = Array.isArray(proposal?.missing) ? proposal.missing : [];
                const allowedTools = [
                    'wallets.create',
                    'categories.create',
                    'transactions.create',
                    'transfers.create',
                    'savings.create',
                    'debts.create',
                    'budgets.set'
                ];

                if (!proposal?.tool || !allowedTools.includes(proposal.tool)) {
                    const reply = 'Mình chưa hỗ trợ thao tác này đúng định dạng. Bạn thử diễn đạt lại nhé.';
                    await Promise.all([
                        Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                        Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply)
                    ]);
                    return res.json({ reply, session_id: sessionId });
                }

                if (missing.length > 0) {
                    const reply = `Mình cần thêm thông tin để thực hiện chính xác: ${missing.join(', ')}. Bạn cung cấp giúp mình nhé.`;
                    await Promise.all([
                        Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                        Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply)
                    ]);
                    return res.json({ reply, session_id: sessionId });
                }

                pendingActions.set(sessionId, {
                    tool: proposal.tool,
                    params: proposal.params || {},
                    createdAt: Date.now()
                });

                const reply = proposal.confirmation_question || 'Bạn xác nhận cho mình thực hiện thao tác chứ?';
                await Promise.all([
                    Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                    Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply)
                ]);

                return res.json({ reply, session_id: sessionId });
            } catch (e) {
                console.error('Tool proposal error:', e.message || e);
                const reply = 'Mình gặp lỗi khi chuẩn bị thao tác. Bạn thử lại sau nhé.';
                await Promise.all([
                    Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                    Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply)
                ]);
                return res.json({ reply, session_id: sessionId });
            }
        }

        // ── 3. Build MAIN prompt with context (centralized in prompts.js) ──
        const today = new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const systemPrompt = buildSystemPrompt(today, intent, contextData);

        // ── 4. Get / create session ───────────────────────────────────

        // Route hiện tại luôn có :sessionId, nhưng vẫn giữ guard để an toàn.
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