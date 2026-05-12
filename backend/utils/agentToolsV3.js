const db = require('../config/db');
const Wallet = require('../model/walletModel');
const Category = require('../model/categoryModel');

// Fix #1: Import từ sqlValidator.js — nguồn duy nhất cho cả V2 lẫn V3
const { validateSql, validateSqlWithExplain } = require('./sqlValidator');

const MAX_QUERY_ROWS = 100;

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

// ─── HELPER: Ép LIMIT tối đa MAX_QUERY_ROWS ───────────────────────────────
// Fix #4: Thay vì chỉ thêm LIMIT khi chưa có, phải override mọi LIMIT > 100
// để tránh trường hợp AI tự ghi "LIMIT 5000" qua kiểm tra.
const capQueryLimit = (sql) => {
    const limitRx = /\bLIMIT\s+(\d+)(\s*,\s*\d+)?\b/i;
    const match = limitRx.exec(sql);

    if (!match) {
        // Chưa có LIMIT → thêm vào cuối
        return `${sql} LIMIT ${MAX_QUERY_ROWS}`;
    }

    const existingLimit = parseInt(match[1], 10);
    if (existingLimit <= MAX_QUERY_ROWS) {
        // Limit hợp lệ → giữ nguyên
        return sql;
    }

    // Limit vượt ngưỡng → override thành MAX_QUERY_ROWS
    return sql.replace(limitRx, `LIMIT ${MAX_QUERY_ROWS}`);
};

// ─── TOOL EXECUTION LOGIC ─────────────────────────────────────────────────
/**
 * Thực thi Tool được AI yêu cầu.
 * Kết quả trả về là Object (parsed) để AgentService xử lý tín hiệu đặc biệt
 * rồi mới JSON.stringify trả về cho LLM như Observation.
 */
const executeTool = async (name, args, userId) => {
    switch (name) {
        case 'get_user_account_context': {
            try {
                const [wallets, categories] = await Promise.all([
                    Wallet.getAllWalletsByUserId(userId),
                    Category.getAllCategoriesByUserId(userId),
                ]);
                return {
                    wallets: wallets.map(w => ({ name: w.name, type: w.type, balance: w.balance })),
                    categories: categories.map(c => ({ name: c.name, type: c.type }))
                };
            } catch (err) {
                return { error: `Lỗi khi lấy context: ${err.message}` };
            }
        }

        case 'query_database': {
            const { sql } = args;

            // 1. Kiểm tra bảo mật tĩnh (chỉ SELECT, chỉ bảng hợp lệ, bắt buộc user_id)
            const secCheck = validateSql(sql, userId);
            if (!secCheck.ok) {
                return { error: `SQL bị từ chối: ${secCheck.reason}` };
            }

            // 2. EXPLAIN để bắt lỗi syntax cơ bản của MySQL (column không tồn tại, sai JOIN...)
            // Lưu ý: EXPLAIN không bắt được ONLY_FULL_GROUP_BY — lỗi đó chỉ xuất hiện khi chạy thật.
            // Nếu thực thi bị lỗi GROUP BY, error sẽ được trả về ở bước 3 để AI tự sửa.
            const explainResult = await validateSqlWithExplain(sql);
            if (!explainResult.ok) {
                return { error: `Lỗi SQL: ${explainResult.error}. Hãy kiểm tra lại tên cột, tên bảng, và sửa lại câu SQL.` };
            }

            // 3. Chạy thực tế với LIMIT hard-cap tối đa 100 dòng (Fix #4)
            try {
                const finalSql = capQueryLimit(sql);
                const [rows] = await db.execute(finalSql);

                if (!rows || rows.length === 0) {
                    return { result: "Không có dữ liệu phù hợp." };
                }

                // Convert chuỗi số (vd: '2000000.00') thành số nguyên để LLM không bị ảo giác
                return rows.map(row => {
                    const obj = {};
                    for (const [k, v] of Object.entries(row)) {
                        obj[k] = (typeof v === 'string' && /^-?\d+\.\d+$/.test(v)) ? Number(v) : v;
                    }
                    return obj;
                });
            } catch (err) {
                // Bắt lỗi ONLY_FULL_GROUP_BY tại đây và trả về cho AI tự sửa
                return { error: `Lỗi khi thực thi SQL: ${err.message}. Nếu lỗi liên quan GROUP BY, hãy thêm tất cả cột không-aggregate vào mệnh đề GROUP BY hoặc bọc bằng ANY_VALUE().` };
            }
        }

        case 'propose_transaction': {
            // Fix #3: Validate args trước khi chấp nhận đề xuất
            const { wallet_name, category_name, type, amount, date } = args;
            if (!wallet_name || !category_name) {
                return { error: 'Tên ví và danh mục không được để trống. Hãy hỏi lại người dùng.' };
            }
            if (type !== 'INCOME' && type !== 'EXPENSE') {
                return { error: `Loại giao dịch không hợp lệ: "${type}". Chỉ chấp nhận INCOME hoặc EXPENSE.` };
            }
            if (!amount || Number(amount) <= 0) {
                return { error: 'Số tiền phải là số dương. Hãy hỏi lại người dùng.' };
            }
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return { error: `Ngày giao dịch không hợp lệ: "${date}". Định dạng phải là YYYY-MM-DD.` };
            }

            // Tín hiệu đặc biệt: AgentService sẽ bắt action này và ngắt vòng lặp
            return {
                action: "PENDING_TRANSACTION",
                data: { wallet_name, category_name, type, amount: Number(amount), date, note: args.note || '' },
            };
        }

        case 'ask_user_clarification': {
            // Tín hiệu đặc biệt: AgentService sẽ bắt action này và ngắt vòng lặp
            return {
                action: "CLARIFICATION_REQUEST",
                data: args.question,
            };
        }

        default:
            return { error: `Tool "${name}" không tồn tại. Các tool hợp lệ: get_user_account_context, query_database, propose_transaction, ask_user_clarification.` };
    }
};

module.exports = {
    toolDeclarations,
    executeTool,
};
