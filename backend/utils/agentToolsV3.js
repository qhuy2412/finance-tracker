const db = require('../config/db');
const Wallet = require('../model/walletModel');
const Category = require('../model/categoryModel');

// ─── TOOL DEFINITIONS (GOOGLE GEN AI SCHEMA) ─────────────────────────────
const toolDeclarations = [
    {
        name: "get_user_account_context",
        description: "Lấy danh sách các Ví (Wallets) và Danh mục (Categories) hiện có của người dùng. Hãy gọi công cụ này khi bạn cần kiểm tra tên ví hoặc danh mục hợp lệ trước khi đề xuất giao dịch.",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    },
    {
        name: "query_database",
        description: "Chạy câu lệnh SQL SELECT để tra cứu dữ liệu (số dư, giao dịch, ngân sách, nợ...). CHỈ CHO PHÉP lệnh SELECT. Luôn dùng JOIN categories c ON t.category_id=c.id AND (c.user_id IS NULL OR c.user_id='user_id') khi lấy tên danh mục.",
        parameters: {
            type: "OBJECT",
            properties: {
                sql: {
                    type: "STRING",
                    description: "Câu lệnh SQL SELECT."
                }
            },
            required: ["sql"]
        }
    },
    {
        name: "propose_transaction",
        description: "Đề xuất tạo mới một giao dịch (thu/chi). Gọi công cụ này khi người dùng yêu cầu ghi lại chi tiêu/thu nhập. Không tự động đoán ví/danh mục nếu không chắc chắn.",
        parameters: {
            type: "OBJECT",
            properties: {
                wallet_name: { type: "STRING", description: "Tên ví" },
                category_name: { type: "STRING", description: "Tên danh mục" },
                type: { type: "STRING", description: "Loại giao dịch: 'INCOME' (Thu nhập) hoặc 'EXPENSE' (Chi tiêu)" },
                amount: { type: "NUMBER", description: "Số tiền (số dương)" },
                date: { type: "STRING", description: "Ngày giao dịch (YYYY-MM-DD)" },
                note: { type: "STRING", description: "Ghi chú (nếu có)" }
            },
            required: ["wallet_name", "category_name", "type", "amount", "date"]
        }
    },
    {
        name: "ask_user_clarification",
        description: "Dừng vòng lặp và đặt câu hỏi cho người dùng. Dùng khi thông tin mập mờ, thiếu tên ví, thiếu tên danh mục, hoặc không rõ là thu hay chi.",
        parameters: {
            type: "OBJECT",
            properties: {
                question: {
                    type: "STRING",
                    description: "Câu hỏi bạn muốn hỏi người dùng."
                }
            },
            required: ["question"]
        }
    }
];

// ─── SQL SECURITY VALIDATORS ──────────────────────────────────────────────
const ALLOWED_TABLES = new Set([
    'transactions', 'wallets', 'categories',
    'transfers', 'saving_goals', 'debts', 'budgets',
    'saving_transactions'
]);

const validateSql = (sql, userId) => {
    if (!sql || typeof sql !== 'string') return { ok: false, reason: 'SQL rỗng' };
    const trimmed = sql.trim();

    if (!/^\s*SELECT\b/i.test(trimmed)) return { ok: false, reason: 'Chỉ cho phép lệnh SELECT' };

    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|EXEC|EXECUTE|GRANT|REVOKE|SHOW|CALL|LOAD|OUTFILE)\b/i;
    if (forbidden.test(trimmed)) return { ok: false, reason: 'Phát hiện từ khoá SQL bị cấm' };

    if (/\bSELECT\b.+\bINTO\b/is.test(trimmed)) return { ok: false, reason: 'SELECT INTO bị cấm' };

    const tableRx = /\b(?:FROM|JOIN)\s+[`"]?(\w+)[`"]?/gi;
    let match;
    while ((match = tableRx.exec(trimmed)) !== null) {
        const tbl = match[1].toLowerCase();
        if (!ALLOWED_TABLES.has(tbl)) return { ok: false, reason: `Bảng không được phép truy cập: ${tbl}` };
    }

    const escapedId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const userIdRx = new RegExp(`(?:\\w+\\.)?user_id\\s*=\\s*'${escapedId}'`, 'i');
    if (!userIdRx.test(trimmed)) {
        return { ok: false, reason: "Bảo mật: SQL thiếu điều kiện lọc [alias.]user_id = 'uuid'." };
    }

    return { ok: true };
};

const validateSqlWithExplain = async (sql) => {
    try {
        await db.execute(`EXPLAIN ${sql}`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
};

// ─── TOOL EXECUTION LOGIC ─────────────────────────────────────────────────
/**
 * Thực thi các Tool. 
 * Kết quả trả về phải là String (JSON stringified) để LLM đọc như Observation.
 */
const executeTool = async (name, args, userId) => {
    switch (name) {
        case 'get_user_account_context': {
            try {
                const [wallets, categories] = await Promise.all([
                    Wallet.getAllWalletsByUserId(userId),
                    Category.getAllCategoriesByUserId(userId),
                ]);
                const context = {
                    wallets: wallets.map(w => ({ name: w.name, type: w.type, balance: w.balance })),
                    categories: categories.map(c => ({ name: c.name, type: c.type }))
                };
                return JSON.stringify(context);
            } catch (err) {
                return JSON.stringify({ error: `Lỗi khi lấy context: ${err.message}` });
            }
        }

        case 'query_database': {
            const sql = args.sql;
            
            // 1. Kiểm tra an toàn bảo mật
            const secCheck = validateSql(sql, userId);
            if (!secCheck.ok) {
                return JSON.stringify({ error: `SQL bị từ chối: ${secCheck.reason}` });
            }

            // 2. Chạy EXPLAIN để MySQL tự test lỗi (vd: ONLY_FULL_GROUP_BY)
            const explainResult = await validateSqlWithExplain(sql);
            if (!explainResult.ok) {
                // Trả lỗi này về cho LLM để nó tự biết đường sửa
                return JSON.stringify({ error: `Lỗi MySQL Syntax: ${explainResult.error}. Hãy sửa lại câu SQL và gọi lại tool này.` });
            }

            // 3. Chạy thực tế (Giới hạn tối đa 100 dòng để chống nổ token)
            try {
                // Wrap in subquery to enforce hard limit securely just in case
                let finalSql = sql;
                if (!/LIMIT\s+\d+/i.test(finalSql)) {
                    finalSql = `${finalSql} LIMIT 100`;
                }

                const [rows] = await db.execute(finalSql);
                
                if (!rows || rows.length === 0) return JSON.stringify({ result: "Không có dữ liệu phù hợp." });
                
                // Cắt lấy 100 dòng đầu và convert số tiền dạng chuỗi sang số nguyên
                const cleanRows = rows.slice(0, 100).map(row => {
                    const obj = {};
                    for (const [k, v] of Object.entries(row)) {
                        obj[k] = (typeof v === 'string' && /^-?\d+\.\d+$/.test(v)) ? Number(v) : v;
                    }
                    return obj;
                });
                
                return JSON.stringify(cleanRows);
            } catch (err) {
                return JSON.stringify({ error: `Lỗi khi thực thi SQL: ${err.message}` });
            }
        }

        case 'propose_transaction': {
            // Trả về JSON để AgentService bắt được tín hiệu "PENDING_TRANSACTION"
            return JSON.stringify({ 
                status: "success", 
                action: "PENDING_TRANSACTION", 
                data: args,
                message: "Đã ghi nhận yêu cầu tạo giao dịch. Yêu cầu AI thông báo cho người dùng xác nhận 'Đồng ý' hoặc 'Hủy'."
            });
        }

        case 'ask_user_clarification': {
            // Trả về tín hiệu "CLARIFICATION_REQUEST"
            return JSON.stringify({
                status: "success",
                action: "CLARIFICATION_REQUEST",
                data: args.question,
                message: "Hãy dừng suy nghĩ và đưa câu hỏi này trực tiếp cho người dùng."
            });
        }

        default:
            return JSON.stringify({ error: `Tool ${name} không tồn tại trong hệ thống.` });
    }
};

module.exports = {
    toolDeclarations,
    executeTool,
    ALLOWED_TABLES,
    validateSql,
    validateSqlWithExplain
};
