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
const financeService = require('../services/financeService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const chatModel = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });
const routerModel = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

const READ_ONLY_HINT =
    'Mình chỉ có thể xem và phân tích dữ liệu tài chính của bạn trong chat. ' +
    'Để tạo ví, chuyển tiền, nợ, ngân sách hoặc sửa/xóa dữ liệu, bạn vui lòng dùng các màn hình tương ứng trong ứng dụng FinTra nhé.';

const PENDING_TTL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// ─── In-memory pending store với cleanup định kỳ ─────────────────────
// TODO: Thay bằng Redis khi scale multi-instance
const pendingActions = new Map();

const cleanupExpiredPending = () => {
    const now = Date.now();
    for (const [sessionId, action] of pendingActions.entries()) {
        if (now - action.createdAt > PENDING_TTL_MS) {
            pendingActions.delete(sessionId);
        }
    }
};
setInterval(cleanupExpiredPending, CLEANUP_INTERVAL_MS);

// ─── Helpers ──────────────────────────────────────────────────────────

const isConfirm = (text) => {
    const t = (text || '').toLowerCase().trim();
    return /^(đồng ý|ok|okay|xác nhận|confirm|làm luôn|làm tiếp|thực hiện|chuẩn|được rồi|được|có|đúng|chính xác|chuẩn rồi|ôk)$/i.test(t) ||
        t.includes('đồng ý') || t.includes('xác nhận') ||
        t.includes('làm luôn') || t.includes('thực hiện');
};

// FIX: isCancel chặt hơn — không match "không phải", "không rõ", v.v.
const isCancel = (text) => {
    const t = (text || '').toLowerCase().trim();
    // Khớp chính xác hoặc câu bắt đầu bằng từ hủy
    return /^(hủy|huỷ|không|từ chối|cancel|ko|stop)$/i.test(t) ||
        /^(hủy|huỷ|cancel|stop)\b/.test(t) ||
        /^(từ chối)\b/.test(t);
    // KHÔNG dùng t.includes('không') — quá rộng, match nhầm "không phải ví Momo..."
};

const isTrivialGreeting = (text) => {
    const t = (text || '').trim();
    if (!t || t.length > 40) return false;
    if (/\d/.test(t)) return false;
    if (/(ví|tiền|ngân|giao\s*dịch|chi\s*tiêu|thu\s*nhập|nợ|số\s*dư|tạo|ghi|chuyển|mở|danh\s*mục|tiết\s*kiệm|vay|lương|báo\s*cáo)/i.test(t)) return false;
    return /^(hello|chao\s+xìn|chào|xin\s+chào|hi|hello\s+cậu|hey|chào\s+bạn|chào\s+cậu|chào\s+nhé|chào\s+anh|chào\s+chị|good\s+morning|good\s+afternoon)([!.，。…\s]*)?$/iu.test(t);
};

const looksLikeTransactionCreate = (text) => {
    const t = (text || '').trim();
    if (!t || !/\d/.test(t)) return false;
    if (/chuyển\s+tiền\s+(từ|sang|vào|giữa)|chuyển\s+giữa\s+các\s+ví/i.test(t)) return false;
    if (/(tạo|mở|thêm)\s+ví|tạo\s+danh\s*mục|thiết\s*lập\s+ngân\s*sách|cho\s+vay|đi\s+vay|tạo\s+nợ|trả\s+nợ|thanh\s+toán\s+nợ/i.test(t)) return false;
    const incomeCue = /(thu\s*nhập|lương|nhận\s*(tiền|lương)|bán\s+hàng|doanh\s*thu)/i.test(t);
    const expenseCue = /(chi|tiêu|mua|ăn|uống|phở|cà\s*phê|vé|hóa\s*đơn)/i.test(t);
    const recordCue = /(ghi|nhập|thêm|khai\s+báo)/i.test(t);
    return incomeCue || expenseCue || recordCue;
};

const isLikelyFollowUp = (text) => {
    const t = (text || '').trim().toLowerCase();
    if (!t) return false;
    if (t.length <= 60 && /(thế|vậy|còn|còn lại|so với|so sánh|tháng trước|tuần trước|hôm qua|lần đó|cái đó|đó|nó|ở trên|như vậy|tiếp theo)\b/.test(t)) {
        return true;
    }
    if (t.length <= 25 && /\?+$/.test(t)) return true;
    return false;
};

const findByNameCi = (rows, name) => {
    if (!name || !Array.isArray(rows)) return null;
    const n = String(name).trim().toLowerCase();
    return rows.find((r) => (r.name || '').trim().toLowerCase() === n) || null;
};

const formatTransactionErrorVi = (msg) => {
    const m = String(msg || '');
    if (/Wallet not found/i.test(m)) return 'Không tìm thấy ví theo tên đã chọn.';
    if (/Category not found/i.test(m)) return 'Không tìm thấy danh mục theo tên đã chọn.';
    if (/Not enough balance/i.test(m)) return 'Số dư ví không đủ cho khoản chi này.';
    if (/must be either INCOME or EXPENSE/i.test(m)) return 'Loại giao dịch không hợp lệ.';
    if (/Amount must be a positive number/i.test(m)) return 'Số tiền phải là số dương.';
    return m || 'Không thể tạo giao dịch.';
};

const WRITE_INTENTS = new Set(['CREATE', 'UPDATE', 'DELETE', 'TRANSFER', 'DEBT', 'SAVING']);

const TABLE_FETCHERS = {
    wallets: async (userId) => {
        const wallets = await Wallet.getAllWalletsByUserId(userId);
        const reservedRows = await Saving.getReservedAmountPerWallet(userId);
        return wallets.map(w => {
            const reservedRow = reservedRows.find(r => r.wallet_id === w.id);
            const reserved = reservedRow ? Number(reservedRow.reserved) : 0;
            return {
                ...w,
                reserved_for_savings: reserved,
                available_balance: Number(w.balance) - reserved
            };
        });
    },
    categories: (userId) => Category.getAllCategoriesByUserId(userId),
    transactions: (userId) => Transaction.getRecentTransactionsByUserId(userId, 50),
    transfers: (userId) => Transfer.getAllTrasnfersByUserId(userId),
    saving_goals: (userId) => Saving.getAllSavingsByUserId(userId),
    debts: (userId) => Debt.getAllDebtsByUserId(userId),
    budgets: (userId) => Budget.getBudgetStatusByUserId(userId),
};

const EMPTY_MESSAGES = {
    wallets: 'Bạn chưa có ví nào. Hãy tạo ví trong app trước, rồi nhắn mình ghi chi tiêu nhé.',
    transactions: 'Mình chưa thấy bạn có giao dịch nào. Bạn hãy thêm vài giao dịch rồi hỏi lại nhé.',
    budgets: 'Mình chưa thấy bạn thiết lập ngân sách. Bạn hãy tạo ngân sách rồi hỏi lại nhé.',
    saving_goals: 'Mình chưa thấy bạn có mục tiêu tiết kiệm nào. Bạn hãy tạo mục tiêu tiết kiệm rồi hỏi lại nhé.',
    debts: 'Mình chưa thấy bạn có khoản nợ nào được ghi nhận. Nếu bạn muốn theo dõi nợ, hãy tạo khoản nợ rồi hỏi lại nhé.',
    transfers: 'Mình chưa thấy bạn có giao dịch chuyển tiền nội bộ nào. Bạn hãy tạo giao dịch chuyển tiền rồi hỏi lại nhé.',
};

// ─── POST /chat/send ────────────────────────────────────────────────
const handleChat = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message } = req.body;

        if (!message) return res.status(400).json({ error: 'message is required' });

        let sessionId = req.params.sessionId;
        if (!sessionId || sessionId === 'undefined') {
            sessionId = uuidv4().trim();
            await Chat.createSession(sessionId, userId);
        }

        const sendReply = async (reply, { fireAndForget = false } = {}) => {
            const saves = Promise.all([
                Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply),
                Chat.touchSession(sessionId),
            ]);

            if (fireAndForget) {
                saves.catch(e => console.error('[Chat] Save failed:', e));
                return res.json({ reply, session_id: sessionId });
            }
            await saves;
            return res.json({ reply, session_id: sessionId });
        };

        if (isTrivialGreeting(message)) {
            return sendReply(
                'Chào bạn! Mình là trợ lý FinTra, có thể giúp bạn xem số dư, chi tiêu hoặc ghi giao dịch thu/chi. Bạn cần gì thì nhắn nhé!',
                { fireAndForget: true }
            );
        }

        let pendingCorrection = null;
        const pending = pendingActions.get(sessionId);
        if (pending?.kind === 'transaction') {
            if (Date.now() - pending.createdAt > PENDING_TTL_MS) {
                pendingActions.delete(sessionId);
            } else if (isCancel(message)) {
                pendingActions.delete(sessionId);
                return sendReply('Mình đã hủy, không ghi giao dịch.');
            } else if (isConfirm(message)) {
                pendingActions.delete(sessionId);
                try {
                    await financeService.createTransaction(userId, pending.params);
                    return sendReply('Đã ghi giao dịch thành công. Bạn cần gì thêm không?');
                } catch (e) {
                    return sendReply(formatTransactionErrorVi(e.message));
                }
            } else {
                // User đang sửa (không phải xác nhận, không phải hủy hoàn toàn)
                // Giữ lại params cũ làm hint cho extraction, rồi re-run
                pendingCorrection = pending.params;
                pendingActions.delete(sessionId);
            }
        }

        const routerHistory = await Chat.getMessages(sessionId);
        const routerUserContent = buildRouterUserContent(message, routerHistory);
        const routerResultFull = await routerModel.generateContent(routerUserContent);
        const rawJson = routerResultFull.response.text().replace(/```json|```/g, '').trim();

        let intent = 'GENERAL', tables = [], direct_reply = '';
        try {
            const parsed = JSON.parse(rawJson);
            intent = typeof parsed.intent === 'string' ? parsed.intent : 'GENERAL';
            tables = Array.isArray(parsed.tables) ? parsed.tables : [];
            direct_reply = typeof parsed.direct_reply === 'string' ? parsed.direct_reply : '';
        } catch {
            console.warn('[Router] JSON parse failed. Raw:', rawJson?.slice(0, 200));
        }

        // Bắt lỗi AI "ảo giác" trả về CREATE_TRANSACTION cho những câu cộc lốc như "ăn phở", "momo" (không số, không ngữ cảnh)
        if (intent === 'CREATE_TRANSACTION' && !pendingCorrection) {
            const hasNumberOrKeyword = /\d/.test(message) || /(ghi|chi|thu|tiêu|xài|mua|bán)/i.test(message);
            const lastMsg = routerHistory.length > 0 ? routerHistory[routerHistory.length - 1] : null;
            const isAnsweringMissingInfo = lastMsg && lastMsg.role === 'assistant' && lastMsg.content.includes('Mình cần thêm thông tin');

            if (!hasNumberOrKeyword && !isAnsweringMissingInfo) {
                intent = 'GENERAL'; // Ép hạ cấp thành chat bình thường
                tables = [];
            }
        }

        const looksLikeTransferCommand = /chuyển\s+tiền\s+(từ|sang|vào|giữa)|chuyển\s+giữa\s+các\s+ví/i.test(message);
        const lowerMessage = (message || '').toLowerCase();
        const looksLikeOtherWrite =
            /(tạo|thêm|ghi|thiết lập|đặt|mở\s+ví|mở ví|sửa|xóa|huỷ|hủy|trả\s+nợ|thanh\s+toán\s+nợ|pay)\b/.test(lowerMessage) ||
            looksLikeTransferCommand;
        const looksLikeFinanceWrite = looksLikeOtherWrite && /(ví|danh\s*mục|giao\s*dịch|ngân\s*sách|tiết\s*kiệm|nợ|chuyển|tiền)/i.test(message);
        const followUp = isLikelyFollowUp(message);

        const isTxnCreate =
            intent === 'CREATE_TRANSACTION' ||
            pendingCorrection !== null ||   // user đang sửa giao dịch đề xuất
            (intent === 'GENERAL' && looksLikeTransactionCreate(message));


        if (intent === 'GENERAL' && !isTxnCreate && !looksLikeFinanceWrite && !followUp) {
            return sendReply(direct_reply || 'Tôi có thể giúp gì cho bạn về tài chính hôm nay?');
        }

        if (isTxnCreate) {
            const todayISO = new Date().toISOString().slice(0, 10);
            let wallets = [], categories = [];
            try {
                [wallets, categories] = await Promise.all([
                    Wallet.getAllWalletsByUserId(userId),
                    Category.getAllCategoriesByUserId(userId),
                ]);
            } catch {
                return sendReply('Mình chưa tải được ví hoặc danh mục. Bạn thử lại sau nhé.');
            }

            if (!wallets.length) return sendReply('Bạn chưa có ví nào. Hãy tạo ví trong app trước, rồi nhắn mình ghi chi tiêu nhé.');

            const catsForTxn = categories.filter(c => {
                const t = String(c.type || '').toUpperCase();
                return t === 'INCOME' || t === 'EXPENSE';
            });
            if (!catsForTxn.length) return sendReply('Bạn chưa có danh mục thu/chi phù hợp. Hãy tạo danh mục trong app trước nhé.');

            try {
                const todayVn = new Date().toLocaleDateString('vi-VN', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                });
                
                const routerHistoryLines = routerHistory.slice(-5).map(m => {
                    const label = m.role === 'assistant' ? 'Trợ lý' : 'Người dùng';
                    return `${label}: ${m.content}`;
                }).join('\n');

                // Nếu user đang sửa giao dịch đề xuất, inject hint để LLM giữ lại thông tin cũ
                const correctionHint = pendingCorrection
                    ? `\n\n[GỢI Ý: Đây là sửa đổi giao dịch vừa đề xuất. Giữ nguyên các trường KHÔNG được đề cập trong tin nhắn mới. Giao dịch cũ: ví="${pendingCorrection.wallet_name}", danh mục="${pendingCorrection.category_name}", loại=${pendingCorrection.type}, số tiền=${pendingCorrection.amount}, ngày=${pendingCorrection.transaction_date}]`
                    : '';

                const proposalPrompt = buildSystemPrompt(
                    todayVn, 'CREATE_TRANSACTION',
                    { wallets, categories: catsForTxn },
                    { transactionExtract: { userMessage: message, todayISO, historyBlock: routerHistoryLines + correctionHint } }
                );
                const proposalResult = await chatModel.generateContent(proposalPrompt);
                const rawProposal = proposalResult.response.text().replace(/```json|```/g, '').trim();
                const proposal = JSON.parse(rawProposal);

                const allowedMissing = [
                    'chưa rõ ví', 'chưa rõ danh mục',
                    'chưa rõ loại giao dịch (thu hay chi)', 'chưa rõ số tiền',
                    'chưa có ví này trong hệ thống'
                ];
                const missing = Array.isArray(proposal?.missing)
                    ? proposal.missing.filter(m => allowedMissing.includes(String(m || '').trim().toLowerCase()))
                    : [];

                if (missing.length > 0) {
                    return sendReply(`Mình cần thêm thông tin: ${missing.join(', ')}. Bạn nhắn rõ giúp mình nhé.`);
                }

                const wName = proposal.wallet_name;
                const cName = proposal.category_name;
                const type = String(proposal.type || '').toUpperCase();
                const amount = Number(proposal.amount);
                const tDate = proposal.transaction_date || todayISO;
                const note = typeof proposal.note === 'string' ? proposal.note : '';

                const walletRow = findByNameCi(wallets, wName);
                const catRow = findByNameCi(catsForTxn, cName);
                const catType = String(catRow?.type || '').toUpperCase();

                if (!walletRow || !catRow || (type !== 'INCOME' && type !== 'EXPENSE') || !Number.isFinite(amount) || amount <= 0 || !tDate) {
                    return sendReply('Mình chưa chốt được ví, danh mục, loại hoặc số tiền hợp lệ. Bạn nói lại đầy đủ (ví, danh mục, số tiền, thu hay chi) giúp mình nhé.');
                }

                if (catType !== type) {
                    return sendReply(`Danh mục "${catRow.name}" là loại ${catType === 'INCOME' ? 'thu nhập' : 'chi tiêu'}, không khớp với giao dịch "${type}". Bạn chọn lại giúp mình nhé.`);
                }

                const params = { wallet_name: walletRow.name, category_name: catRow.name, type, amount, transaction_date: tDate, note };
                pendingActions.set(sessionId, { kind: 'transaction', params, createdAt: Date.now() });

                const reply = proposal.confirmation_question ||
                    `Bạn xác nhận ghi ${type === 'EXPENSE' ? 'chi' : 'thu'} ${amount.toLocaleString('vi-VN')} đ từ ví "${walletRow.name}", danh mục "${catRow.name}", ngày ${tDate}? Trả lời "Đồng ý" hoặc "Hủy".`;

                return sendReply(reply);
            } catch (e) {
                console.error('[Transaction proposal]', e.message || e);
                return sendReply('Mình chưa hiểu đủ để ghi giao dịch. Bạn thử nói rõ: số tiền, thu hay chi, danh mục và ví nhé.');
            }
        }

        if (WRITE_INTENTS.has(intent) || looksLikeFinanceWrite) {
            return sendReply(READ_ONLY_HINT);
        }

        if (tables.length === 0) {
            if (followUp) {
                tables = ['transactions', 'wallets', 'categories'];
            } else {
                return sendReply(direct_reply || 'Tôi có thể giúp gì cho bạn về tài chính hôm nay?');
            }
        }

        const contextData = {};
        const contextErrors = {};

        await Promise.all(
            tables
                .filter(t => TABLE_FETCHERS[t])
                .map(t =>
                    TABLE_FETCHERS[t](userId)
                        .then(rows => { contextData[t] = rows; })
                        .catch((err) => {
                            contextErrors[t] = true; contextData[t] = null;
                        })
                )
        );

        const failedTables = Object.keys(contextErrors);
        if (failedTables.length > 0) {
            console.error('[Chat] Tables that failed:', failedTables);
            return sendReply('Mình chưa truy xuất được dữ liệu tài chính của bạn ngay lúc này. Bạn thử lại sau vài giây nhé.');
        }

        const firstEmpty = tables.find(t => Array.isArray(contextData[t]) && contextData[t].length === 0);
        if (firstEmpty && EMPTY_MESSAGES[firstEmpty]) {
            return sendReply(EMPTY_MESSAGES[firstEmpty]);
        }

        const today = new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const systemPrompt = buildSystemPrompt(today, intent, contextData);

        await Chat.touchSession(sessionId);

        // Xử lý chatHistory: gộp các role liên tiếp và format đúng chuẩn Gemini
        const rawHistory = routerHistory.slice(-20);
        const chatHistory = [];
        for (const m of rawHistory) {
            const role = m.role === 'assistant' ? 'model' : 'user';
            if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === role) {
                chatHistory[chatHistory.length - 1].parts[0].text += `\n\n${m.content}`;
            } else {
                chatHistory.push({ role, parts: [{ text: m.content }] });
            }
        }

        // Gemini yêu cầu trước khi gọi sendMessage (role: user) thì history phải kết thúc bằng model
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
            chatHistory.push({ role: 'model', parts: [{ text: 'Đã nhận thông tin, mời bạn nói tiếp.' }] });
        }

        const chat = chatModel.startChat({
            history: chatHistory,
        });

        // Nhúng TÌNH TRẠNG DỮ LIỆU HIỆN TẠI trực tiếp vào phiên hỏi này để đảm bảo AI ưu tiên nó nhất
        const fullMessage = `${systemPrompt}\n\n=== CHAT MỚI TỪ NGƯỜI DÙNG ===\n${message}`;

        const result = await chat.sendMessage(fullMessage);
        return sendReply(result.response.text());

    } catch (error) {
        console.error('[Chat] Unhandled error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── GET /chat/sessions ───────────────────────────────────────────────
const getSessions = async (req, res) => {
    try {
        const sessions = await Chat.getSessionList(req.user.id);
        return res.json(sessions);
    } catch (error) {
        console.error('[getSessions]', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── POST /chat/sessions ──────────────────────────────────────────────
const createSession = async (req, res) => {
    try {
        const sessionId = uuidv4();
        await Chat.createSession(sessionId, req.user.id);
        return res.status(201).json({ session_id: sessionId });
    } catch (error) {
        console.error('[createSession]', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── GET /chat/sessions/:sessionId/messages ───────────────────────────
const getMessages = async (req, res) => {
    try {
        const messages = await Chat.getMessages(req.params.sessionId);
        return res.json(messages);
    } catch (error) {
        console.error('[getMessages]', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { handleChat, getSessions, createSession, getMessages };