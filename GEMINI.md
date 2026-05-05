# Workspace Rules — FinTra (Antigravity)

---

## 1. Tổng quan Sản phẩm

- **Tên sản phẩm**: FinTra — Finance Tracker
- **Mô tả**: Ứng dụng quản lý tài chính cá nhân, hỗ trợ theo dõi ví, giao dịch, ngân sách, khoản nợ, mục tiêu tiết kiệm, và tích hợp AI chatbot tư vấn tài chính
- **Giai đoạn**: Beta
- **Người dùng chính**: End-user B2C (cá nhân muốn quản lý tài chính)

### Môi trường
| Môi trường | URL | Ghi chú |
|---|---|---|
| Local Frontend | http://localhost:5173 | Vite dev server |
| Local Backend | http://localhost:9999 | Express API |
| Production | Chưa xác định | Cần approval trước khi deploy |

---

## 2. Tech Stack

### Frontend
- Framework: **React 19** (Vite)
- Styling: **Tailwind CSS v4** + shadcn/ui (Base UI)
- State management: **Zustand** (`src/store/`)
- HTTP client: **Axios** (`src/services/`)
- UI components: `lucide-react`, `recharts`, `react-toastify`
- Package manager: npm
- Thư mục: `./frontend/src/`

### Backend
- Runtime: **Node.js** (CommonJS)
- Framework: **Express v5**
- Database: **MySQL** (mysql2)
- ORM: Raw SQL queries (không dùng ORM)
- Authentication: **JWT** (httpOnly cookie) + bcrypt
- AI: **Groq SDK** (LLM chatbot) + **Google Generative AI** (bill scanning)
- Email: **Resend** + Nodemailer
- API style: **REST**
- Thư mục: `./backend/`

### Infrastructure
- CI/CD: **GitHub Actions** (`.github/`)
- Database: MySQL (self-hosted / cloud)
- File storage: Không dùng (base64 cho bill scan)

---

## 3. Cấu trúc Thư mục Chính

```
FinTra/
├── frontend/
│   ├── src/
│   │   ├── components/     # Shared UI components (shadcn/ui based)
│   │   ├── pages/          # Route-level pages
│   │   ├── services/       # Axios API calls (apiService.js)
│   │   ├── store/          # Zustand stores
│   │   ├── utils/          # Helpers, formatters
│   │   ├── lib/            # clsx, tailwind-merge utils
│   │   ├── App.jsx         # Router setup (react-router-dom v7)
│   │   └── main.jsx        # Entry point
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── config/
│   │   └── db.js           # MySQL connection pool
│   ├── controller/         # Business logic handlers
│   ├── middleware/         # auth.js (JWT verify), rateLimit
│   ├── model/              # Raw SQL query functions (không phải ORM)
│   │   ├── userModel.js
│   │   ├── walletModel.js
│   │   ├── transactionModel.js
│   │   ├── budgetModel.js
│   │   ├── savingModel.js
│   │   ├── debtModel.js
│   │   ├── transferModel.js
│   │   ├── categoryModel.js
│   │   ├── chatModel.js
│   │   └── billRoute.js
│   ├── router/             # Express route definitions
│   ├── services/           # External services (AI, email)
│   ├── utils/              # promptsV2.js (LLM system prompt), helpers
│   ├── server.js           # Entry point, middleware setup
│   └── package.json
├── tests/                  # Test files
├── .github/                # GitHub Actions CI/CD
├── GEMINI.md               # File này
└── README.md
```

---

## 4. Quy ước Code của Dự án

### Đặt tên
- Components: PascalCase — `WalletCard.jsx`, `TransactionList.jsx`
- Pages: PascalCase — `Dashboard.jsx`, `Savings.jsx`
- Services/utils: camelCase — `apiService.js`, `formatDate.js`
- API routes: kebab-case — `/api/wallets`, `/api/savings`
- Database tables: snake_case — `users`, `wallets`, `transactions`, `saving_goals`
- Backend models: camelCase functions — `getUserById()`, `createWallet()`

### Import
- Frontend: relative imports từ `src/` (chưa cấu hình alias `@/`)
- Backend: CommonJS `require()`, không dùng ES Modules

### Styling
- Tailwind CSS v4 utility classes
- shadcn/ui components (Base UI based, không phải Radix)
- Không dùng inline style, không viết CSS riêng trừ khi animation phức tạp

### JavaScript (không có TypeScript)
- Backend: CommonJS, không có type checking
- Frontend: JSX (không phải TSX), `jsconfig.json` cho IDE support
- Wrap tất cả async operations trong try/catch

---

## 5. Tính năng Chính & Luồng Nghiệp vụ

### Auth
- Mô tả: Đăng ký, đăng nhập, đăng xuất, quên mật khẩu (OTP qua email)
- Files: `router/authRoute.js`, `controller/authController.js`, `model/userModel.js`
- API: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- Lưu ý: JWT lưu trong httpOnly cookie, không localStorage

### Wallet (Ví)
- Mô tả: Tạo/sửa/xóa ví, xem số dư, chuyển tiền giữa ví
- Files: `router/walletRoute.js`, `controller/walletController.js`, `model/walletModel.js`
- API: `GET/POST/PUT/DELETE /api/wallets`, `POST /api/transfers`

### Transactions (Giao dịch)
- Mô tả: Thu/chi tiền, lọc theo danh mục, khoảng thời gian
- Files: `router/transactionRoute.js`, `controller/transactionController.js`, `model/transactionModel.js`
- API: `GET/POST/PUT/DELETE /api/transactions`

### Budget (Ngân sách)
- Mô tả: Đặt ngân sách theo danh mục, theo dõi chi tiêu so với ngân sách
- Files: `router/budgetRoute.js`, `controller/budgetController.js`, `model/budgetModel.js`
- API: `GET/POST/PUT/DELETE /api/budgets`

### Savings (Tiết kiệm)
- Mô tả: Tạo mục tiêu tiết kiệm, nạp tiền từ nhiều ví, rút/hoàn trả theo tỷ lệ đóng góp
- Files: `router/savingRoute.js`, `controller/savingController.js`, `model/savingModel.js`
- API: `GET/POST/PUT /api/savings`, `POST /api/savings/:id/contribute`, `POST /api/savings/:id/withdraw`, `POST /api/savings/:id/disburse`
- Lưu ý: Withdrawal logic phức tạp — chỉ rút được theo tỷ lệ đóng góp từng ví

### Debt (Khoản nợ)
- Mô tả: Theo dõi khoản nợ (mình vay / người khác vay mình)
- Files: `router/debtRoute.js`, `controller/debtController.js`, `model/debtModel.js`
- API: `GET/POST/PUT/DELETE /api/debts`

### AI Chatbot
- Mô tả: Chat tư vấn tài chính, truy vấn DB bằng ngôn ngữ tự nhiên (Groq LLM)
- Files: `router/chatRoute.js`, `controller/chatController.js`, `utils/promptsV2.js`
- API: `POST /api/chat`
- Lưu ý: LLM generate SQL → validate → execute → trả kết quả. Chỉ cho phép SELECT

### Bill Scanning
- Mô tả: Upload ảnh hóa đơn, AI extract thông tin, tự động tạo transaction
- Files: `router/billRoute.js`, `controller/billController.js`
- API: `POST /api/bills/scan`
- Lưu ý: Dùng Google Generative AI (Gemini), ảnh gửi dưới dạng base64

---

## 6. Database

### Schema tóm tắt
```
users              — id, name, email, password_hash, created_at
wallets            — id, user_id (FK), name, balance, currency, icon, created_at
categories         — id, user_id (FK), name, type (income/expense), icon
transactions       — id, user_id, wallet_id, category_id, amount, type, note, date
transfers          — id, user_id, from_wallet_id, to_wallet_id, amount, note, date
saving_goals       — id, user_id, name, target_amount, current_amount, deadline, status
saving_contributions — id, saving_goal_id, wallet_id, amount, type (contribute/withdraw)
budgets            — id, user_id, category_id, amount, period, start_date, end_date
debts              — id, user_id, name, amount, type (lend/borrow), due_date, status
chat_history       — id, user_id, role, content, created_at
```

### Quy tắc
- Không bao giờ xóa cột đang có data — dùng soft delete nếu cần
- Mọi thay đổi schema phải có migration script kèm theo
- Backup DB trước mọi thay đổi trên production
- Raw SQL queries — không dùng ORM, cẩn thận SQL injection (dùng parameterized queries)

---

## 7. Lệnh Thường Dùng

```bash
# Khởi động dev
cd backend && npm run dev       # Backend: http://localhost:9999 (nodemon)
cd frontend && npm run dev      # Frontend: http://localhost:5173 (Vite)

# Build Frontend
cd frontend && npm run build    # Output: frontend/dist/

# Lint Frontend
cd frontend && npm run lint     # ESLint

# Preview build
cd frontend && npm run preview
```

---

## 8. Quy tắc Browser Testing cho Dự án này

### Flow cần test sau mỗi thay đổi lớn
1. **Auth flow**: Đăng ký → Đăng nhập → Đăng xuất → Quên mật khẩu (OTP)
2. **Wallet flow**: Tạo ví → Xem số dư → Chuyển tiền giữa ví
3. **Transaction flow**: Thêm thu/chi → Lọc theo danh mục → Xem dashboard
4. **Savings flow**: Tạo mục tiêu → Nạp tiền từ nhiều ví → Rút tiền → Hoàn trả
5. **Chatbot flow**: Hỏi tổng quan tài chính → Query giao dịch → Query ngân sách
6. **Bill scan flow**: Upload ảnh hóa đơn → Review extracted data → Tạo transaction

### Tài khoản test
- (Lưu ý: không commit thông tin này lên Git — chỉ lưu local)
- Tạo account qua flow đăng ký thông thường khi test

---

## 9. Vấn đề Đã Biết & Cần Tránh

- **CORS**: Hiện tại `origin: true` (cho phép mọi origin) — cần hạn chế lại khi production
- **Savings withdrawal**: Logic rút tiền phức tạp, phải dựa trên contribution ratio — không sửa tùy tiện
- **SQL injection**: Model dùng raw SQL, luôn dùng parameterized queries (`?` placeholder), không string concatenation
- **LLM SQL generation**: Chatbot generate SQL → phải validate chỉ cho phép SELECT trước khi execute
- **Base64 images**: Bill scan gửi ảnh base64 trong body → limit payload `10mb` trong server.js, đừng tăng quá mức cần
- **JWT cookie**: httpOnly cookie, không thể access từ JS — không cần set `Authorization` header ở frontend

---

## 10. Định nghĩa "Hoàn thành" (Definition of Done)

Một task được coi là xong khi:
- [ ] Code chạy đúng logic yêu cầu
- [ ] Không có lỗi JS runtime / ESLint
- [ ] Đã test bằng browser (có screenshot)
- [ ] Không có `console.log` hay debug code
- [ ] Commit message đúng format: `type(scope): mô tả ngắn`
- [ ] Không có secret bị lộ trong code
- [ ] API có ownership check (user chỉ truy cập data của mình)

---

## 11. Quy tắc Ra Quyết định (Decision Rules)

### Bắt buộc hỏi lại trước khi làm
- Yêu cầu mơ hồ liên quan đến schema DB (thêm/sửa/xóa cột)
- Thay đổi logic savings withdrawal hoặc balance calculation
- Thêm npm dependency mới
- Thay đổi cấu trúc auth, JWT, hoặc middleware
- Thay đổi response shape của API hiện có (có thể break frontend)
- Bất kỳ thay đổi nào ảnh hưởng >3 files cùng lúc

### Tự làm không cần hỏi
- Fix bug rõ ràng (typo, sai logic hiển thị, sai validation)
- Thêm validation đầu vào ở controller
- Refactor trong 1 file duy nhất, không đổi interface ra ngoài
- Cải thiện error message hoặc thêm comment

---

## 12. Hard Rules — Không Bao Giờ Vi Phạm

1. **Không sửa savings withdrawal logic** mà không giải thích rõ impact đến contribution ratio
2. **Không dùng string concatenation trong SQL** — luôn dùng `?` placeholder (parameterized query)
3. **Không tạo route mới** mà không có ownership check (`WHERE user_id = ?`)
4. **Không lưu JWT vào localStorage** — httpOnly cookie là chuẩn của dự án
5. **Không commit file `.env`** hoặc bất kỳ secret nào lên Git
6. **Không tăng payload limit** vượt `10mb` trong server.js
7. **Không để `console.log`** trong code sau khi debug xong

---

## 13. Thứ tự Ưu tiên (Priority Order)

Khi có mâu thuẫn giữa các yêu cầu, ưu tiên theo thứ tự:

1. **Bảo mật** — ownership check, SQL injection, secret exposure
2. **Tính đúng đắn** — logic savings/budget calculation chính xác
3. **Trải nghiệm người dùng** — UI không bị broken, lỗi hiển thị rõ ràng
4. **Performance** — tối ưu query, tránh N+1
5. **Code cleanliness** — naming, structure, comment

> Xem thêm: `backend/GEMINI.md` và `frontend/GEMINI.md` cho rules chi tiết từng layer.