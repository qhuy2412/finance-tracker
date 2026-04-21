const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

const Chat = require('../model/chatModel');
const Wallet = require('../model/walletModel');
const Category = require('../model/categoryModel');
const Saving = require('../model/savingModel');
const db = require('../config/db');

const {
    buildUnifiedPrompt,
    buildSqlFixPrompt,
    buildSummaryPrompt,
    sanitizeHistoryLine,
    sanitizeUserId,
    ALLOWED_TABLES,
} = require('../utils/promptsV2');
const financeService = require('../services/financeService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

const READ_ONLY_HINT =
    'Mình chỉ có thể xem và phân tích dữ liệu tài chính của bạn trong chat. ' +
    'Để tạo ví, chuyển tiền, nợ, ngân sách hoặc sửa/xóa dữ liệu, bạn vui lòng dùng các màn hình tương ứng trong ứng dụng FinTra nhé.';

const PENDING_TTL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const pendingActions = new Map();

const cleanupExpiredPending = () => {
    const now = Date.now();
    for (const [sid, action] of pendingActions.entries()) {
        if (now - action.createdAt > PENDING_TTL_MS) pendingActions.delete(sid);
    }
};
setInterval(cleanupExpiredPending, CLEANUP_INTERVAL_MS);

// ─── Helpers ──────────────────────────────────────────────────────────────

const isConfirm = (text) => {
    const t = (text || '').toLowerCase().trim();
    return /^(đồng ý|ok|okay|xác nhận|confirm|làm luôn|làm tiếp|thực hiện|chuẩn|được rồi|được|có|đúng|chính xác|chuẩn rồi|ôk)$/i.test(t) ||
        t.includes('đồng ý') || t.includes('xác nhận') ||
        t.includes('làm luôn') || t.includes('thực hiện');
};

const isCancel = (text) => {
    const t = (text || '').toLowerCase().trim();
    return /^(hủy|huỷ|không|từ chối|cancel|ko|stop)$/i.test(t) ||
        /^(hủy|huỷ|cancel|stop)\b/.test(t) ||
        /^(từ chối)\b/.test(t);
};

const isTrivialGreeting = (text) => {
    const t = (text || '').trim();
    if (!t || t.length > 40) return false;
    if (/\d/.test(t)) return false;
    if (/(ví|tiền|ngân|giao\s*dịch|chi\s*tiêu|thu\s*nhập|nợ|số\s*dư|tạo|ghi|chuyển|mở|danh\s*mục|tiết\s*kiệm|vay|lương|báo\s*cáo)/i.test(t)) return false;
    return /^(hello|chào|xin\s+chào|hi|hey|chào\s+bạn|chào\s+anh|chào\s+chị|good\s+morning|good\s+afternoon)([!.…\s]*)?$/iu.test(t);
};

const findByNameCi = (rows, name) => {
    if (!name || !Array.isArray(rows)) return null;
    const norm = (s) => String(s).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const n = norm(name);
    return rows.find((r) => norm(r.name) === n) || null;
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

const parseJson = (raw) => {
    const cleaned = raw.replace(/```json/ig, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
};

// ─── EXPLAIN-based SQL validator ───────────────────────────────────────────
/**
 * Chạy EXPLAIN trước để MySQL tự bắt lỗi syntax, ONLY_FULL_GROUP_BY, invalid column...
 * Trả về { ok: true } hoặc { ok: false, error: "MySQL error message" }
 */
const validateSqlWithExplain = async (sql) => {
    try {
        await db.execute(`EXPLAIN ${sql}`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
};

/**
 * Phân tích câu SQL tĩnh, đảm bảo:
 * 1. Chỉ là SELECT
 * 2. Không chứa từ khoá nguy hiểm
 * 3. Chỉ dùng bảng trong ALLOWED_TABLES
 * 4. Có userId xuất hiện đâu đó trong SQL (trực tiếp hoặc qua JOIN)
 * Trả về { ok: true } hoặc { ok: false, reason: "..." }
 */
const validateSql = (sql, userId) => {
    if (!sql || typeof sql !== 'string') return { ok: false, reason: 'SQL rỗng' };
    const trimmed = sql.trim();

    // Phải bắt đầu bằng SELECT (bỏ qua khoảng trắng đầu)
    if (!/^\s*SELECT\b/i.test(trimmed)) return { ok: false, reason: 'Chỉ cho phép SELECT' };

    // Từ khoá DML / DDL nguy hiểm
    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|EXEC|EXECUTE|GRANT|REVOKE|SHOW|CALL|LOAD|OUTFILE)\b/i;
    if (forbidden.test(trimmed)) return { ok: false, reason: 'Từ khoá SQL bị cấm' };

    // INTO chỉ nguy hiểm nếu là SELECT INTO, không phải COALESCE/INSERT INTO
    if (/\bSELECT\b.+\bINTO\b/is.test(trimmed)) return { ok: false, reason: 'SELECT INTO bị cấm' };

    // Kiểm tra tất cả tên bảng sau FROM / JOIN (bỏ qua alias và subquery parens)
    const tableRx = /\b(?:FROM|JOIN)\s+[`"]?(\w+)[`"]?/gi;
    let match;
    while ((match = tableRx.exec(trimmed)) !== null) {
        const tbl = match[1].toLowerCase();
        if (!ALLOWED_TABLES.has(tbl)) return { ok: false, reason: `Bảng không được phép: ${tbl}` };
    }

    // Bắt buộc userId xuất hiện dưới dạng [alias.]user_id = 'uuid'
    // - Chấp nhận: user_id='x', t.user_id='x', sg.user_id='x'...
    // - Từ chối: user_id != 'x', user_id LIKE '%x%'
    // saving_transactions JOIN qua saving_goals nên sẽ có sg.user_id = '...'
    const escapedId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const userIdRx = new RegExp(`(?:\\w+\\.)?user_id\\s*=\\s*'${escapedId}'`, 'i');
    if (!userIdRx.test(trimmed)) {
        return { ok: false, reason: 'SQL thiếu [alias.]user_id = \'uuid\' filter' };
    }

    return { ok: true };
};

// ─── LLM call helper ─────────────────────────────────────────────────────
const callLlm = async (prompt) => {
    const result = await model.generateContent(prompt);
    return result.response.text();
};

// ─── Main handler ────────────────────────────────────────────────────────
const handleChatV2 = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'message is required' });

        let sessionId = req.params.sessionId;
        if (!sessionId || sessionId === 'undefined') {
            sessionId = uuidv4().trim();
            await Chat.createSession(sessionId, userId);
        }

        // send reply — trả response ngay, save DB async (fire-and-forget)
        const sendReply = (reply) => {
            Promise.all([
                Chat.saveMessage(uuidv4(), sessionId, 'user', message),
                Chat.saveMessage(uuidv4(), sessionId, 'assistant', reply),
                Chat.touchSession(sessionId),
            ]).catch(e => console.error('[Chat] Save failed:', e));
            return res.json({ reply, session_id: sessionId });
        };

        // ── Shortcut: trivial greeting ────────────────────────────────────
        if (isTrivialGreeting(message)) {
            return sendReply('Chào bạn! Mình là trợ lý FinTra. Bạn cần xem báo cáo tài chính hay ghi chi tiêu nhỉ?');
        }

        // ── Pending confirmation flow ─────────────────────────────────────
        let pendingCorrection = null;
        const pending = pendingActions.get(sessionId);
        if (pending?.kind === 'transaction') {
            if (Date.now() - pending.createdAt > PENDING_TTL_MS) {
                pendingActions.delete(sessionId);
            } else if (isCancel(message)) {
                pendingActions.delete(sessionId);
                return sendReply('Mình đã hủy thao tác lưu giao dịch.');
            } else if (isConfirm(message)) {
                pendingActions.delete(sessionId);
                try {
                    await financeService.createTransaction(userId, pending.params);
                    return sendReply('Đã ghi giao dịch thành công nhé!');
                } catch (e) {
                    return sendReply(formatTransactionErrorVi(e.message));
                }
            } else {
                pendingCorrection = pending.params;
                pendingActions.delete(sessionId);
            }
        }

        // ── Load history + lightweight context (wallets + categories) ─────
        const [history, wallets, categories] = await Promise.all([
            Chat.getMessages(sessionId),
            Wallet.getAllWalletsByUserId(userId),
            Category.getAllCategoriesByUserId(userId),
        ]);

        const historyBlock = history
            .slice(-10)
            .map(m => `${m.role === 'assistant' ? 'Trợ lý' : 'Người dùng'}: ${sanitizeHistoryLine(m.content)}`)
            .join('\n');

        const today = new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const todayISO = new Date().toISOString().slice(0, 10);

        // ── Bước 1: 1 LLM call — phân loại + sinh SQL (nếu cần) ──────────────────────
        const unifiedPrompt = buildUnifiedPrompt(today, userId, wallets, categories, message, historyBlock);
        let unifiedResult;
        try {
            const raw = await callLlm(unifiedPrompt);
            unifiedResult = parseJson(raw);
        } catch (e) {
            console.error('[UnifiedLLM] Parse failed:', e.message);
            return sendReply('Mình chưa hiểu ý bạn. Bạn thử diễn đạt lại nhé!');
        }

        const action = unifiedResult.action || 'GENERAL';

        // ── GENERAL / REJECT ───────────────────────────────────────────────────
        if (action === 'GENERAL') {
            const reply = unifiedResult.general_reply || READ_ONLY_HINT;
            return sendReply(reply);
        }

        // ── CREATE_TRANSACTION ───────────────────────────────────────────────────
        if (action === 'CREATE_TRANSACTION') {
            const tx = unifiedResult.transaction || {};

            // Kết hợp hint khi user đang sửa giao dịch cũ.
            // Chỉ fallback khi LLM trả về giá trị rỗng hoặc literal "null" string.
            const isBlank = (v) => !v || v === 'null';
            if (pendingCorrection) {
                if (isBlank(tx.wallet_name)) tx.wallet_name = pendingCorrection.wallet_name;
                if (isBlank(tx.category_name)) tx.category_name = pendingCorrection.category_name;
                if (isBlank(tx.type)) tx.type = pendingCorrection.type;
                if (!(tx.amount > 0)) tx.amount = pendingCorrection.amount;
                if (isBlank(tx.transaction_date)) tx.transaction_date = pendingCorrection.transaction_date;
            }

            const missing = Array.isArray(tx.missing) ? tx.missing : [];
            if (missing.length > 0) {
                return sendReply(`Mình cần thêm thông tin: ${missing.join(', ')}. Bạn nhắn rõ giúp mình nhé.`);
            }

            const catsForTxn = categories.filter(c => {
                const t = String(c.type || '').toUpperCase();
                return t === 'INCOME' || t === 'EXPENSE';
            });
            if (!wallets.length) return sendReply('Bạn chưa có ví nào. Hãy tạo ví trong app trước nhé.');
            if (!catsForTxn.length) return sendReply('Bạn chưa có danh mục thu/chi. Hãy tạo danh mục trong app trước nhé.');

            const walletRow = findByNameCi(wallets, tx.wallet_name);
            const catRow = findByNameCi(catsForTxn, tx.category_name);
            const type = String(tx.type || '').toUpperCase();
            const amount = Number(tx.amount);

            if (!walletRow) return sendReply(`Mình không thấy ví "${tx.wallet_name}". Bạn nhắn tên ví chính xác giúp mình nhé.`);
            if (!catRow) return sendReply(`Mình không thấy danh mục "${tx.category_name}". Bạn chọn lại danh mục giúp mình nhé.`);
            if (type !== 'INCOME' && type !== 'EXPENSE') return sendReply('Mình chưa rõ đây là khoản thu hay chi. Bạn xác nhận giúp mình nhé.');
            if (!Number.isFinite(amount) || amount <= 0) return sendReply('Số tiền không hợp lệ. Bạn nhắn lại số tiền rõ hơn nhé.');
            if (catRow.type.toUpperCase() !== type) {
                return sendReply(`Danh mục "${catRow.name}" là loại ${catRow.type === 'INCOME' ? 'thu' : 'chi'}, không khớp. Bạn chọn lại nhé.`);
            }

            const params = {
                wallet_name: walletRow.name,
                category_name: catRow.name,
                type,
                amount,
                transaction_date: tx.transaction_date || todayISO,
                note: tx.note || '',
            };
            pendingActions.set(sessionId, { kind: 'transaction', params, createdAt: Date.now() });

            const reply =
                `Bạn xác nhận thông tin sau:\n` +
                `- Loại: ${type === 'EXPENSE' ? 'Chi tiêu' : 'Thu nhập'}\n` +
                `- Số tiền: ${amount.toLocaleString('vi-VN')} đ\n` +
                `- Ví: "${walletRow.name}"\n` +
                `- Danh mục: "${catRow.name}"\n` +
                `- Ngày: ${params.transaction_date}\n\n` +
                `Trả lời "Đồng ý" để lưu hoặc "Hủy" để bỏ qua.`;
            return sendReply(reply);
        }

        // ── QUERY_DATA: Text-to-SQL flow ────────────────────────────────────
        if (action === 'QUERY_DATA') {
            // SQL được sinh sẵn trong cùng 1 LLM call ở trên
            let sql = unifiedResult.sql || '';
            let explanation = unifiedResult.sql_explanation || '';

            if (!sql || !sql.trim().toUpperCase().startsWith('SELECT')) {
                console.error('[QueryData] No valid SQL in unified result');
                return sendReply('Mình chưa tổng hợp được câu trưy vấn. Bạn thử hỏi lại theo cách khác nhé.');
            }

            // Bước 3a: Whitelist + keyword security check
            const secCheck = validateSql(sql, userId);
            if (!secCheck.ok) {
                console.warn('[SqlValidate] Rejected:', secCheck.reason, '| SQL:', sql);
                return sendReply('Mình chưa thể truy vấn dữ liệu này an toàn. Bạn thử hỏi cách khác nhé.');
            }

            // Bước 3b: EXPLAIN — MySQL tự kiểm tra syntax + GROUP BY
            // Bước 3b: EXPLAIN — Retry loop tối đa 2 lần
            const MAX_SQL_FIX_RETRIES = 2;
            for (let attempt = 0; ; attempt++) {
                const explainResult = await validateSqlWithExplain(sql);
                if (explainResult.ok) break; // SQL hợp lệ, tiếp tục

                console.warn(`[SqlExplain] Attempt ${attempt + 1} failed:`, explainResult.error, '\n  SQL:', sql);

                if (attempt >= MAX_SQL_FIX_RETRIES) {
                    console.error('[SqlFix] Exceeded max retries');
                    return sendReply('Mình gặp lỗi khi truy vấn bảng dữ liệu. Bạn thử hỏi lại nhé.');
                }

                // Gửi SQL + lỗi cho LLM tự sửa
                try {
                    const fixRaw = await callLlm(buildSqlFixPrompt(sql, explainResult.error, userId));
                    const fixed = parseJson(fixRaw);

                    const secCheck2 = validateSql(fixed.sql, userId);
                    if (!secCheck2.ok) {
                        console.error('[SqlFix] Fixed SQL failed security:', secCheck2.reason);
                        return sendReply('Mình gặp lỗi khi truy vấn bảng dữ liệu. Bạn thử hỏi lại nhé.');
                    }

                    console.info(`[SqlFix] Attempt ${attempt + 1}: applying fixed SQL`);
                    sql = fixed.sql;
                    explanation = fixed.explanation || explanation;
                } catch (fixErr) {
                    console.error('[SqlFix] Parse error:', fixErr.message);
                    return sendReply('Mình gặp lỗi khi truy vấn bảng dữ liệu. Bạn thử hỏi lại nhé.');
                }
            }

            // Bước 4: Thực thi SQL
            let rows = [];
            try {
                const [result] = await db.execute(sql);
                rows = result;
            } catch (e) {
                console.error('[SqlExec] Error:', e.message, '| SQL:', sql);
                return sendReply('Mình bị lỗi khi truy vấn dữ liệu. Bạn thử hỏi lại nhé.');
            }

            // Bước 5: LLM format kết quả thành câu trả lời tự nhiên (có history để xử lý follow-up)
            const summaryPrompt = buildSummaryPrompt(message, explanation, rows, historyBlock);
            let finalReply;
            try {
                finalReply = await callLlm(summaryPrompt);
                finalReply = finalReply.replace(/```[a-z]*/gi, '').replace(/```/g, '').trim();
            } catch (e) {
                console.error('[Summary] LLM error:', e.message);
                return sendReply('Mình lấy được dữ liệu nhưng không tổng hợp được. Bạn thử lại nhé.');
            }

            return sendReply(finalReply);
        }


        // fallback
        return sendReply(READ_ONLY_HINT);

    } catch (error) {
        console.error('[ChatV2 Unhandled]', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── Các endpoint phụ ────────────────────────────────────────────────────
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
        return res.json(await Chat.getMessages(req.params.sessionId));
    } catch (e) {
        console.error('[getMessages]', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { handleChat: handleChatV2, getSessions, createSession, getMessages };
