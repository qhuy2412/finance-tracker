// ─── SECURITY: Bảng và cột được phép trong NL2SQL ─────────────────────────
const ALLOWED_TABLES = new Set([
    'transactions', 'wallets', 'categories',
    'transfers', 'saving_goals', 'debts', 'budgets',
    'saving_transactions'
]);

// Schema mô tả để đưa vào prompt - đủ để LLM viết câu SQL đúng column name
const DB_SCHEMA = `
-- ============================================================
-- SCHEMA THỰC TẾ CỦA DATABASE FINTRA (MySQL)
-- ============================================================

-- wallets
--   id          VARCHAR(36) PK
--   user_id     VARCHAR(36) FK→users.id
--   name        VARCHAR(100)
--   type        ENUM('CASH','BANK','E_WALLET')
--   balance     DECIMAL(15,2)
--   created_at  TIMESTAMP

-- categories
--   id          VARCHAR(36) PK
--   user_id     VARCHAR(36) NULL  ← NULL = danh mục hệ thống (dùng chung)
--   name        VARCHAR(100)
--   type        ENUM('INCOME','EXPENSE')
--   color, icon VARCHAR
--   ⚠ Khi JOIN categories, filter: (c.user_id IS NULL OR c.user_id = '<userId>')

-- transactions
--   id               VARCHAR(36) PK
--   user_id          VARCHAR(36) FK→users.id
--   wallet_id        VARCHAR(36) FK→wallets.id
--   category_id      VARCHAR(36) NULL FK→categories.id
--   saving_id        VARCHAR(36) NULL
--   transfer_id      VARCHAR(36) NULL
--   debt_id          VARCHAR(36) NULL
--   type             ENUM('INCOME','EXPENSE','DEBT_IN','DEBT_OUT','TRANSFER_IN','TRANSFER_OUT','SAVING_IN','SAVING_OUT')
--   amount           DECIMAL(15,2)
--   note             TEXT NULL
--   transaction_date DATE
--   created_at       TIMESTAMP
--   ⚠ Thu nhập thuần: type IN ('INCOME','DEBT_IN')
--   ⚠ Chi tiêu thuần: type IN ('EXPENSE','DEBT_OUT')
--   ⚠ Chuyển tiền nội bộ: type IN ('TRANSFER_IN','TRANSFER_OUT')
--   ⚠ Tiết kiệm: type IN ('SAVING_IN','SAVING_OUT')

-- transfers
--   id             VARCHAR(36) PK
--   user_id        VARCHAR(36) FK→users.id
--   from_wallet_id VARCHAR(36) FK→wallets.id
--   to_wallet_id   VARCHAR(36) FK→wallets.id
--   amount         DECIMAL(15,2)
--   transfer_date  DATE
--   created_date   TIMESTAMP
--   ⚠ KHÔNG có cột note

-- debts
--   id          VARCHAR(36) PK
--   user_id     VARCHAR(36) FK→users.id
--   wallet_id   VARCHAR(36) FK→wallets.id
--   person_name VARCHAR(100)   ← tên người vay/cho vay
--   type        ENUM('BORROW','LEND')  ← BORROW=mình vay, LEND=mình cho vay
--   amount      DECIMAL(15,2)          ← tổng nợ gốc
--   paid_amount DECIMAL(15,2)          ← đã trả
--   status      ENUM('UNPAID','PAID')
--   due_date    DATE NULL
--   note        TEXT NULL
--   created_date TIMESTAMP

-- budgets
--   id          VARCHAR(36) PK
--   user_id     VARCHAR(36) FK→users.id
--   category_id VARCHAR(36) FK→categories.id
--   period      DATE  ← luôn là ngày 1 của tháng, ví dụ: 2026-04-01
--   amount      DECIMAL(15,2)  ← hạn mức ngân sách
--   created_date TIMESTAMP
--   ⚠ KHÔNG có cột spent — phải JOIN transactions để tính chi tiêu thực tế

-- saving_goals
--   id             VARCHAR(36) PK
--   user_id        VARCHAR(36) FK→users.id
--   name           VARCHAR(100)
--   target_amount  DECIMAL(15,2)
--   current_amount DECIMAL(15,2)
--   deadline       DATE NULL
--   status         ENUM('IN_PROGRESS','COMPLETED')
--   created_date   TIMESTAMP

-- saving_transactions
--   id         VARCHAR(36) PK
--   saving_id  VARCHAR(36) FK→saving_goals.id
--   wallet_id  VARCHAR(36) FK→wallets.id
--   type       ENUM('DEPOSIT','WITHDRAW')
--   amount     DECIMAL(15,2)
--   note       VARCHAR(255) NULL
--   created_at TIMESTAMP
--   ⚠ KHÔNG có user_id trực tiếp — JOIN qua saving_goals để filter user
`.trim();


// ─── Prompt định tuyến: phân loại ý định ──────────────────────────────────
const buildRouterPrompt = (today, wallets, categories, userMessage, historyBlock = '') => {
    const walletList = wallets.map(w => `  - "${w.name}" (${w.type}, số dư: ${Number(w.balance).toLocaleString('vi-VN')} đ)`).join('\n');
    const catList = categories.map(c => `  - "${c.name}" (${c.type})`).join('\n');

    return `Bạn là bộ định tuyến thông minh của trợ lý tài chính FinTra.
Hôm nay: ${today}.

## Ví của người dùng:
${walletList || '  (chưa có ví nào)'}

## Danh mục:
${catList || '  (chưa có danh mục nào)'}

## Lịch sử cuộc hội thoại gần đây:
${historyBlock || '(Chưa có)'}

## Tin nhắn hiện tại:
Người dùng: ${userMessage}

---
Nhiệm vụ của bạn: Phân loại tin nhắn trên thành MỘT trong 3 nhóm sau:

**1. CREATE_TRANSACTION** — Người dùng muốn GHI một khoản thu/chi.
   - Phải có số tiền HOẶC người dùng đang trả lời câu hỏi thiếu thông tin của bot trước đó.
   - Các từ mơ hồ như "ăn phở", "momo" mà không có số tiền → KHÔNG phải CREATE_TRANSACTION.

**2. QUERY_DATA** — Người dùng muốn XEM, PHÂN TÍCH, THỐNG KÊ dữ liệu tài chính.
   - Ví dụ: "tháng này tôi tiêu bao nhiêu?", "ví nào nhiều tiền nhất?", "số dư hiện tại?"

**3. GENERAL** — Hội thoại thông thường, từ chối ghi (tạo ví, chuyển tiền, xóa...).

Trích xuất thêm cho CREATE_TRANSACTION:

- wallet_name:
  ⚠ LUẬT THÉP — KHÔNG ĐƯỢC TỰ CHỌN VÍ KHI CÓ NHIỀU HƠN 1 VÍ:
  • Nếu user_id có ĐÚNG 1 ví → được phép dùng ví đó.
  • Nếu user_id có TỪ 2 VÍ TRỞ LÊN → TUYỆT ĐỐI KHÔNG tự chọn, dù ví đó có vẻ "mặc định".
    Chỉ điền wallet_name nếu người dùng nêu tên ví rõ ràng trong tin nhắn HOẶC trong lịch sử trò chuyện.
    Nếu không → đặt wallet_name = "" và thêm "chưa rõ ví" vào missing.
  Danh sách ví hiện có: ${walletList || '(chưa có ví nào)'}

- category_name:
  ⚠ LUẬT THÉP — KHÔNG ĐƯỢC TỰ ĐOÁN DANH MỤC:
  Chỉ điền nếu người dùng mô tả cụ thể (ví dụ: "ăn phở", "đổ xăng", "lương") VÀ có danh mục khớp.
  Nếu người dùng chỉ nói chung chung ("thu nhập", "chi tiêu", "tiêu tiền") → category_name = "" + missing "chưa rõ danh mục".

- type: "INCOME" hoặc "EXPENSE". Rõ ràng thì điền, không rõ → "".
- amount: Số tiền (số nguyên). Không có → 0.
- transaction_date: "YYYY-MM-DD". Mặc định hôm nay nếu không nhắc.
- note: Ghi chú tự nhiên từ mô tả (nếu có).
- missing: Mảng tất cả trường còn thiếu. Ví dụ: ["chưa rõ ví", "chưa rõ danh mục", "chưa rõ số tiền"].

Trả về JSON chuẩn (không có markdown):
{
  "action": "CREATE_TRANSACTION" | "QUERY_DATA" | "GENERAL",
  "general_reply": "Câu trả lời nếu action=GENERAL (từ chối/chat thường), bỏ trống nếu không dùng",
  "transaction": {
    "wallet_name": "",
    "category_name": "",
    "type": "",
    "amount": 0,
    "transaction_date": "YYYY-MM-DD",
    "note": "",
    "missing": []
  }
}`.trim();
};

// ─── Prompt viết SQL ─────────────────────────────────────────────
const buildSqlPrompt = (today, userId, userMessage, historyBlock = '') => {
    return `Bạn là chuyên gia viết câu SQL cho hệ thống quản lý tài chính cá nhân FinTra.
Hôm nay: ${today}.
user_id hiện tại: ${userId} (PHẢI luôn có trong mọi WHERE clause).

## Schema MySQL:
${DB_SCHEMA}

## Lịch sử gần đây:
${historyBlock || '(Chưa có)'}

## Câu hỏi của người dùng:
${userMessage}

---
Viết MỘT câu SQL SELECT duy nhất và CHÍNH XÁC để trả lời câu hỏi trên.

## QUY TẮc BẮT BUỘC:
1. TẮc bảo mật:
   - Chỉ dùng SELECT. TUYỆT ĐỐI KHÔNG INSERT / UPDATE / DELETE / DROP.
   - Mọi bảng đều PHẢI filter user_id = '${userId}'.

2. TẮc JOIN:
   - Luôn JOIN wallets/categories để lấy name thay vì chỉ ID.
   - Dùng DATE_FORMAT, MONTH(), YEAR(), DATE_SUB() cho ngày tháng.
   - Tên cột trả về phải ý nghĩa (dùng AS).

3. QUY TẮc MYSQL ONLY_FULL_GROUP_BY (ĐÂY LÀ QUY TẮc QUAN TRỌNG NHẤT):
   MySQL bắt buộc mọi cột non-aggregate trong SELECT (bao gồm cả cột ở trong CASE WHEN)
   phải có trong GROUP BY.

   CÁC TRƯỜNG HỢP HAY SAI VÀ CÁCH SỬА:

   ❌ SAI — b.amount trong CASE WHEN không được aggregate:
   \`\`\`
   SELECT CASE WHEN SUM(t.amount) > b.amount THEN 'Vượt' ELSE 'OK' END
   FROM transactions t JOIN budgets b ON ...
   \`\`\`
   ✔ ĐÚNG — dùng MAX() cho cột scalar ở trong CASE:
   \`\`\`
   SELECT CASE WHEN SUM(t.amount) > MAX(b.amount) THEN 'Vượt' ELSE 'OK' END
   FROM transactions t JOIN budgets b ON ...
   \`\`\`

   ❌ SAI — c.name trong SELECT không có trong GROUP BY:
   \`\`\`
   SELECT c.name, SUM(t.amount) FROM transactions t JOIN categories c ON ... WHERE ...
   \`\`\`
   ✔ ĐÚNG:
   \`\`\`
   SELECT c.name, SUM(t.amount) AS total FROM transactions t JOIN categories c ON ... WHERE ...
   GROUP BY c.id, c.name
   \`\`\`

   QUY TẮC GHI NHỚ:
   - Bất kỳ column nào xuất hiện trong SELECT mà KHÔNG nằm trong SUM/COUNT/AVG/MAX/MIN
     thì PHẢI có trong GROUP BY.
   - Điều này bao gồm cột bên trong expressions: CASE WHEN, IF(), IFNULL().
   - Nếu bảng lookup (budgets, categories...) chỉ có 1 record/group, dùng MAX(b.amount)
     thay vì b.amount để tránh lỗi.

4. QUY TẮC ĐẶC THÙ FINTRA:

   a) transactions.type — ENUM đầy đủ:
      - Chi tiêu thực sự (trừ chuyển khoản/tiết kiệm): type IN ('EXPENSE')
      - Thu nhập thực sự: type IN ('INCOME')
      - Nếu câu hỏi hỏi "tổng chi", "tổng thu" → CHỈ dùng 'EXPENSE' / 'INCOME', KHÔNG gộp DEBT_OUT hay TRANSFER_OUT
      - Nếu câu hỏi hỏi về nợ: dùng DEBT_IN / DEBT_OUT
      - Nếu câu hỏi hỏi về chuyển tiền: dùng TRANSFER_IN / TRANSFER_OUT

   b) categories.user_id — có thể NULL (system categories):
      Khi JOIN: LEFT JOIN categories c ON t.category_id = c.id AND (c.user_id IS NULL OR c.user_id = '${userId}')

   c) budgets KHÔNG có cột spent — phải tính bằng JOIN:
      SELECT b.amount AS budget_limit,
             COALESCE(SUM(t.amount), 0) AS spent
      FROM budgets b
      LEFT JOIN transactions t
             ON b.category_id = t.category_id
             AND t.user_id = '${userId}'
             AND t.type = 'EXPENSE'
             AND MONTH(t.transaction_date) = MONTH(b.period)
             AND YEAR(t.transaction_date) = YEAR(b.period)
      WHERE b.user_id = '${userId}'
      GROUP BY b.id, b.amount

   d) saving_transactions KHÔNG có user_id — JOIN qua saving_goals:
      FROM saving_transactions st
      JOIN saving_goals sg ON st.saving_id = sg.id
      WHERE sg.user_id = '${userId}'

   e) debts:
      - person_name = tên người vay/cho vay (KHÔNG phải debtor_name hay creditor_name)
      - BORROW = mình đang vay người khác
      - LEND = mình cho người khác vay
      - Số còn nợ thực = amount - paid_amount

Trả về JSON chuẩn (không có markdown):
{
  "sql": "SELECT ...",
  "explanation": "Giải thích ngắn SQL này làm gì"
}`.trim();
};

// ─── Prompt tổng hợp kết quả SQL thành ngôn ngữ tự nhiên ──────────────────
const buildSummaryPrompt = (userMessage, sqlExplanation, sqlRows) => {
    const rowsText = sqlRows.length === 0
        ? '(Không có dữ liệu)'
        : JSON.stringify(sqlRows.slice(0, 200), null, 2); // max 200 rows

    return `Bạn là trợ lý tài chính FinTra. Dưới đây là kết quả truy vấn dữ liệu thực tế từ database.

## Câu hỏi gốc của người dùng:
${userMessage}

## Truy vấn đã thực hiện:
${sqlExplanation}

## Kết quả dữ liệu:
${rowsText}

---
Hãy tổng hợp kết quả trên thành câu trả lời tự nhiên, thân thiện bằng Tiếng Việt.
- Format số tiền theo dạng: 1.500.000 đ
- TUYỆT ĐỐI KHÔNG hiển thị bất kỳ trường ID nào (id, user_id, wallet_id, category_id, saving_id, debt_id, transfer_id...) trong câu trả lời — người dùng không cần biết ID nội bộ.
- Nếu không có dữ liệu → thông báo nhẹ nhàng, đừng bịa đặt.
- Chỉ trả lời văn bản thuần, KHÔNG có JSON, KHÔNG có markdown code block.`.trim();

};

// ─── Sanitize history ─────────────────────────────────────────────────────
const sanitizeHistoryLine = (content) => {
    if (!content) return '';
    return content.replace(/[\n\r]+/g, ' ').replace(/"/g, "'").trim();
};

// ─── Prompt sửa SQL dựa theo lỗi MySQL ─────────────────────────────────────────
const buildSqlFixPrompt = (originalSql, mysqlError, userId) => {
    return `Bạn là chuyên gia sửa lỗi SQL cho MySQL strict mode (ONLY_FULL_GROUP_BY).

SQL gốc:
${originalSql}

Lỗi MySQL:
${mysqlError}

user_id: ${userId} (phải có trong mọi WHERE)

## QUY TẮc SỬА ONLY_FULL_GROUP_BY:
Trong MySQL strict mode, bất kỳ column nào xuất hiện trong SELECT và KHÔNG được bao trong
SUM/COUNT/AVG/MAX/MIN THÌ PHẢI nằm trong GROUP BY. Điều này bao gồm các column nằm trong
CASE WHEN, IF(), IFnull().

CÁC HUẠNG SỬА:

1. Nếu column lookup chỉ có 1 giá trị trong group → dùng MAX() hoặc MIN():
   ❌ SAI: CASE WHEN SUM(t.amount) > b.amount
   ✔ SỬА: CASE WHEN SUM(t.amount) > MAX(b.amount)

   ❌ SAI: CASE WHEN SUM(t.amount) > b.amount THEN b.name
   ✔ SỬА: CASE WHEN SUM(t.amount) > MAX(b.amount) THEN MAX(b.name)

2. Nếu cần GROUP BY nhiều cột → thêm vào GROUP BY:
   ❌ SAI: SELECT c.name, SUM(t.amount) FROM ... JOIN ...
   ✔ SỬА: SELECT c.name, SUM(t.amount) FROM ... JOIN ... GROUP BY c.id, c.name

3. Column trong CASE WHEN vẽ được kiểm tra, không chỉ column trong SELECT trực tiếp.

Kiểm tra kỹ toàn bộ SQL, sửa HẾT TẤT CẢ vi phạm, sau đó trả về JSON (không có markdown):
{
  "sql": "SELECT ...",
  "explanation": "Mô tả ngắn việc đã sửa"
}`.trim();
};



module.exports = {
    buildRouterPrompt,
    buildSqlPrompt,
    buildSummaryPrompt,
    buildSqlFixPrompt,
    sanitizeHistoryLine,
    ALLOWED_TABLES,
};
