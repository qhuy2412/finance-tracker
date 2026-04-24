// ─── SECURITY: Bảng được phép trong NL2SQL ────────────────────────────────
const ALLOWED_TABLES = new Set([
    'transactions', 'wallets', 'categories',
    'transfers', 'saving_goals', 'debts', 'budgets',
    'saving_transactions'
]);

// ─── DB Schema (đúng thực tế) ─────────────────────────────────────────────
const DB_SCHEMA = `
-- 1. MÔ TẢ CÁC BẢNG (TABLE PURPOSES):
-- wallets: Lưu danh sách ví tiền của người dùng và số dư hiện tại.
-- categories: Lưu danh sách danh mục phân loại thu/chi (Ăn uống, Lương...).
-- transactions: Bảng cốt lõi, lưu TẤT CẢ biến động dòng tiền thực tế ra/vào ví (Mua bán, trả nợ, nạp tiết kiệm, v.v.).
-- transfers: Lưu lịch sử chuyển tiền nội bộ giữa 2 ví của cùng 1 người dùng.
-- debts: Lưu các khoản nợ (Đi vay hoặc Cho vay) và trạng thái trả nợ.
-- budgets: Lưu hạn mức ngân sách tối đa mà user đặt ra cho từng danh mục trong tháng.
-- saving_goals: Lưu các quỹ mục tiêu tiết kiệm dài hạn (Ví dụ: Mua xe, Đám cưới) và tiến độ.
-- saving_transactions: Lưu lịch sử những lần nạp tiền (hoặc rút ra) khỏi quỹ tiết kiệm.

-- 2. CẤU TRÚC CỘT (COLUMNS):
-- wallets: id, user_id, name, type ENUM('CASH','BANK','E_WALLET'), balance, created_at
-- categories: id, user_id NULL (NULL=system), name, type ENUM('INCOME','EXPENSE')
--   ⚠ JOIN: LEFT JOIN categories c ON t.category_id = c.id AND (c.user_id IS NULL OR c.user_id = ?)
-- transactions: id, user_id, wallet_id, category_id NULL, type ENUM('INCOME','EXPENSE','DEBT_IN','DEBT_OUT','TRANSFER_IN','TRANSFER_OUT','SAVING_IN','SAVING_OUT'), amount, note, transaction_date DATE, created_at
--   ⚠ CHÚ Ý: "tổng chi" → type='EXPENSE' ONLY. "tổng thu" → type='INCOME' ONLY.
-- transfers: id, user_id, from_wallet_id, to_wallet_id, amount, transfer_date DATE, created_date
-- debts: id, user_id, wallet_id, person_name, type ENUM('BORROW','LEND'), amount, paid_amount, status ENUM('UNPAID','PAID'), due_date, note, created_date
--   ⚠ CHÚ Ý: person_name là tên người liên quan. Còn nợ = amount - paid_amount.
-- budgets: id, user_id, category_id, period DATE (ngày 1 tháng), amount, created_date
--   ⚠ CHÚ Ý: KHÔNG có cột spent — JOIN transactions để tính.
-- saving_goals: id, user_id, name, target_amount, current_amount, deadline, status, created_date
-- saving_transactions: id, saving_id, wallet_id, type ENUM('DEPOSIT','WITHDRAW'), amount, note, created_at
--   ⚠ CHÚ Ý: KHÔNG có user_id — PHẢI JOIN saving_goals sg ON st.saving_id=sg.id WHERE sg.user_id=?
`.trim();

// ─── Sanitize userId trước khi nhúng vào prompt ────────────────────────────
const sanitizeUserId = (userId) => {
    if (!userId || typeof userId !== 'string') return 'INVALID';
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (hex + dashes only)
    return /^[0-9a-f-]{36}$/i.test(userId) ? userId : 'INVALID';
};

// ─── Sanitize history (chống prompt injection) ────────────────────────────
const sanitizeHistoryLine = (content) => {
    if (!content) return '';
    const cleaned = content
        .replace(/[\n\r]+/g, ' ')           // collapse newlines
        .replace(/"/g, "'")                 // neutralise quote
        // strip injection markers
        .replace(/={2,}\s*(QUY\s*TẮC|RULE|SYSTEM|INSTRUCTION|CONTEXT|SQL|SELECT|INSERT|UPDATE|DELETE|IGNORE|FORGET|ABOVE|BELOW|PROMPT)\b/gi, '[REMOVED]')
        .replace(/\b(DROP|DELETE|INSERT|UPDATE|ALTER|TRUNCATE|EXEC|EXECUTE)\b/gi, '[REMOVED]')
        .trim();

    if (cleaned.length <= 500) return cleaned;
    // Cắt tại word boundary gần nhất, tối đa 500 chars
    const cut = cleaned.slice(0, 500);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 400 ? cut.slice(0, lastSpace) : cut) + '…';
};

// ─── Prompt thống nhất: phân loại + sinh SQL trong 1 call ─────────────────
const buildUnifiedPrompt = (today, rawUserId, wallets, categories, userMessage, historyBlock = '') => {
    const userId = sanitizeUserId(rawUserId);
    const walletList = wallets.map(w => `  - "${w.name}" (${w.type}, số dư: ${Number(w.balance).toLocaleString('vi-VN')} đ)`).join('\n');
    const catList = categories.map(c => `  - "${c.name}" (${c.type})`).join('\n');

    return `Bạn là trợ lý tài chính FinTra — phân loại ý định người dùng VÀ sinh SQL trong 1 lượt.
Hôm nay: ${today}.

## Ví của người dùng (${wallets.length} ví):
${walletList || '  (chưa có ví nào)'}

## Danh mục:
${catList || '  (chưa có danh mục nào)'}

## Lịch sử hội thoại gần đây:
${historyBlock || '(Chưa có)'}

## Tin nhắn hiện tại:
Người dùng: ${userMessage}

---
## PHÂN LOẠI action (chọn 1 trong 3):

**CREATE_TRANSACTION** — CHỈ DÙNG khi người dùng muốn GHI THÊM một bản ghi thu/chi mới.
   Điều kiện: Hành động phải là ghi chép tiền bạc (và CÓ SỐ TIỀN cụ thể).
   ⚠ TỪ CHỐI TẤT CẢ YÊU CẦU SAU: "Xóa", "Sửa", "Hủy", "Bỏ", "Tạo ví", "Thêm ví", "Xóa ví", "Đổi tên" (Bất kỳ thao tác thay đổi dữ liệu nào không phải là ghi chép tiêu dùng/thu nhập mới) → BẮT BUỘC CHUYỂN VÀO GENERAL.
   Câu mơ hồ không có số tiền ("ăn phở", "đổ xăng") → KHÔNG dùng CREATE_TRANSACTION.

**QUERY_DATA** — CHỈ DÙNG để XEM / PHÂN TÍCH / LẤY báo cáo (Ví dụ: "Tôi đang có bao nhiêu tiền?", "Tháng này tiêu bao nhiêu?").
   ⚠ TUYỆT ĐỐI CHỈ DÙNG CÂU LỆNH SELECT.

**GENERAL** — Yêu cầu tạo/sửa/xóa ví, sửa/xóa giao dịch, chuyển tiền nội bộ, tạo danh mục. Trợ lý sẽ hiển thị general_reply từ chối và hướng dẫn dùng App.

---
## ĐIỀN THÊM tuỳ action:

### CREATE_TRANSACTION — trích xuất fields:
- wallet_name:
  ⚠ LUẬT THÉP: Nếu có ≥ 2 ví → TUYỆT ĐỐI không tự chọn. Chỉ điền khi user nêu tên ví rõ ràng.
  → Nếu không rõ: wallet_name="" + missing "chưa rõ ví".
- category_name:
  ⚠ LUẬT THÉP: Không đoán từ từ chung chung ("chi tiêu", "thu nhập").
  → Nếu không rõ: category_name="" + missing "chưa rõ danh mục".
- type: "INCOME" hoặc "EXPENSE". Không rõ → "".
- amount: số nguyên. Không có → 0.
- transaction_date: "YYYY-MM-DD". Mặc định hôm nay.
- note: ghi chú nếu có.
- missing: mảng tất cả các trường còn thiếu.

### QUERY_DATA — sinh 1 câu SQL SELECT đúng MySQL:

**CẢNH BÁO: Đây là rule quan trọng nhất ở cuối — đọc kỹ trước khi viết SQL.**

Schema:
${DB_SCHEMA}

QUY TẮC BẮT BUỘC:
1. Chỉ SELECT. KHÔNG INSERT/UPDATE/DELETE/DROP.
2. Mọi bảng tĩnh PHẢI có điều kiện user_id = '${userId}' (qua WHERE hoặc JOIN).
3. DANH MỤC (categories): Khi lọc theo tên, PHẢI dùng lệnh JOIN chính xác như sau (KHÔNG dùng Subquery):
   JOIN categories c ON <bảng>.category_id = c.id AND (c.user_id IS NULL OR c.user_id = '${userId}')
   TUYỆT ĐỐI KHÔNG tự ý thêm c.user_id = '${userId}' vào mệnh đề WHERE.
4. NGÂN SÁCH (budgets): b.period luôn là ngày 1 của tháng (VD tháng này: b.period = DATE_FORMAT(CURDATE(), '%Y-%m-01')). Nếu CHỈ HỎI ngân sách: không cần JOIN transactions. Nếu HỎI VƯỢT NGÂN SÁCH CHƯA: PHẢI dùng LEFT JOIN transactions t (để không bị rỗng nếu chưa chi tiêu gì) và tính SUM(t.amount).
5. saving_transactions không có user_id — JOIN saving_goals để filter.
6. ĐẠI TỪ CHỈ ĐỊNH: Nếu user nói "mục này", "tháng trước", "hôm đó"... PHẢI đọc Lịch sử hội thoại để thay bằng giá trị thật (VD: WHERE c.name = 'Ăn uống' CHỨ KHÔNG ĐƯỢC viết c.name = 'mục này').
7. TRUY VẤN NỢ: Đọc/hỏi nợ TUYỆT ĐỐI CHỈ DÙNG bảng debts (KHÔNG dùng transactions). LEND = Cho vay (người ta nợ mình), BORROW = Đi vay (mình nợ người ta). Dùng status = 'UNPAID' hoặc amount - paid_amount > 0.

MYSQL ONLY_FULL_GROUP_BY — CÁCH XỬ LÝ CHUNG CHO TOÀN BỘ CÁC TRƯỜNG HỢP:
Khi có dùng hàm gộp (SUM, COUNT...) trong SELECT, TẤT CẢ các cột còn lại phải tuân thủ 1 trong 2 cách sau:
CÁCH 1: Đưa tất cả các cột đó vào MỆNH ĐỀ GROUP BY.
  ❌ SAI: SELECT w.name, SUM(t.amount)
  ✔ SỬA: SELECT w.name, SUM(t.amount) GROUP BY w.id, w.name
CÁCH 2: Bọc các cột đó bằng ANY_VALUE() hoặc MAX() nếu không muốn Group By.
  ❌ SAI: SELECT b.amount - SUM(t.amount) AS remaining
  ✔ SỬA: SELECT ANY_VALUE(b.amount) - SUM(t.amount) AS remaining

### GENERAL — điền general_reply:
Phản hồi thân thiện, ngắn gọn.

---
## OUTPUT — JSON duy nhất, KHÔNG có markdown:
{
  "action": "CREATE_TRANSACTION" | "QUERY_DATA" | "GENERAL",
  "general_reply": "string nếu GENERAL, null nếu không",
  "transaction": {
    "wallet_name": "", "category_name": "", "type": "", "amount": 0,
    "transaction_date": "YYYY-MM-DD", "note": "", "missing": []
  },
  "sql": "SELECT ... nếu QUERY_DATA, null nếu không",
  "sql_explanation": "Mô tả ngắn SQL làm gì, null nếu không"
}`.trim();
};

// ─── Prompt tổng hợp kết quả SQL ──────────────────────────────────────────
const MAX_SUMMARY_CHARS = 18000;

const buildSummaryPrompt = (userMessage, sqlExplanation, sqlRows, historyBlock = '') => {
    let rowsText;
    if (!sqlRows || sqlRows.length === 0) {
        rowsText = '(Không có dữ liệu)';
    } else {
        // Tiền xử lý dữ liệu: convert các chuỗi số '2000000.00' thành số nguyên 2000000 
        // để giúp LLM không bị ảo giác (hallucinate) do phần thập phân.
        const cleanRows = sqlRows.map(row => {
            const obj = {};
            for (const [k, v] of Object.entries(row)) {
                if (typeof v === 'string' && /^-?\d+\.\d+$/.test(v)) {
                    obj[k] = Number(v);
                } else {
                    obj[k] = v;
                }
            }
            return obj;
        });

        const limited = cleanRows.slice(0, 150);
        const full = JSON.stringify(limited, null, 2);
        rowsText = full.length > MAX_SUMMARY_CHARS
            ? full.slice(0, MAX_SUMMARY_CHARS) + `\n... (đã cắt bớt, tổng ${sqlRows.length} dòng)`
            : full;
    }

    return `Bạn là trợ lý tài chính FinTra. Dưới đây là kết quả truy vấn dữ liệu thực tế từ database.

## Lịch sử hội thoại gần đây:
${historyBlock || '(Chưa có)'}

## Câu hỏi gốc của người dùng:
${userMessage}

## Truy vấn đã thực hiện:
${sqlExplanation}

## Kết quả dữ liệu:
${rowsText}

---
Hãy tổng hợp kết quả trên thành câu trả lời tự nhiên, thân thiện bằng Tiếng Việt.
- Format số tiền: 1.500.000 đ
- ⚠ ĐỌC ĐÚNG SỐ TIỀN: Đếm thật kỹ số chữ số 0. Ví dụ "2000000" là 2.000.000 đ (2 triệu, 6 số 0). TUYỆT ĐỐI không bị ảo giác làm tròn lên thành 20 triệu.
- KHÔNG hiển thị bất kỳ trường ID nào (id, user_id, wallet_id, category_id, saving_id...).
- 🛡️ CHỐNG "ẢO GIÁC": Luôn MỞ ĐẦU bằng cách nhắc lại ngắn gọn phạm vi dữ liệu đã truy vấn (dựa trên "Truy vấn đã thực hiện" và "Kết quả"). VD: "Theo dữ liệu chi tiêu tháng 4 cho mục Ăn uống...". Điều này giúp người dùng kiểm chứng xem bạn có đang tính sai phạm vi hay không.
- 💡 Xử lý logic hiển thị: Nếu mục tiêu tiết kiệm có \`status\` là "COMPLETED" nhưng \`current_amount\` là 0, giải thích rõ "Mục tiêu đã hoàn thành nhưng tiền đã rút về ví".
- Nếu câu hỏi là follow-up ("thế tháng trước?") → dùng lịch sử hội thoại để trả lời liền mạch.
- Nếu không có dữ liệu → thông báo nhẹ nhàng, không bịa đặt.
- Chỉ trả lời văn bản thuần, KHÔNG có JSON hay markdown code block.`.trim();
};

// ─── Prompt sửa SQL dựa theo lỗi MySQL ───────────────────────────────────
const buildSqlFixPrompt = (originalSql, mysqlError, rawUserId) => {
    const userId = sanitizeUserId(rawUserId);
    return `Bạn là chuyên gia sửa lỗi SQL cho MySQL strict mode (ONLY_FULL_GROUP_BY).

SQL gốc:
${originalSql}

Lỗi MySQL:
${mysqlError}

user_id: ${userId} (phải xuất hiện dưới dạng user_id = '${userId}' trong mọi WHERE)

## QUY TẮC SỬA ONLY_FULL_GROUP_BY:
Mọi column trong SELECT không nằm trong aggregate function THÌ PHẢI trong GROUP BY.
Điều này bao gồm column bên trong CASE WHEN, IF(), IFNULL().

CÁC HƯỚNG SỬA:
1. Column lookup 1 giá trị/group → dùng MAX() hoặc MIN():
   ❌ SAI: CASE WHEN SUM(t.amount) > b.amount
   ✔ SỬA: CASE WHEN SUM(t.amount) > MAX(b.amount)

2. Nhiều cột cần GROUP BY → thêm vào GROUP BY:
   ❌ SAI: SELECT c.name, SUM(t.amount) FROM ... JOIN ...
   ✔ SỬA: SELECT c.name, SUM(t.amount) FROM ... JOIN ... GROUP BY c.id, c.name

3. Column trong CASE WHEN CŨNG bị kiểm tra, không chỉ column ở SELECT trực tiếp.

Kiểm tra kỹ TOÀN BỘ SQL, sửa HẾT vi phạm, trả về JSON (không có markdown):
{
  "sql": "SELECT ...",  
  "explanation": "Mô tả ngắn việc đã sửa"
}`.trim();
};

module.exports = {
    buildUnifiedPrompt,
    buildSqlFixPrompt,
    buildSummaryPrompt,
    sanitizeHistoryLine,
    sanitizeUserId,
    ALLOWED_TABLES,
};
