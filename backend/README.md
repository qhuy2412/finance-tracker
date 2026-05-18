# FinTra — Backend API

REST API for the FinTra personal finance management app. Built with Express v5 + MySQL, with AI integrations (Google Generative AI / Gemini) and Telegram bot support.

## Tech Stack

- **Runtime**: Node.js (CommonJS)
- **Framework**: Express v5
- **Database**: MySQL 8 (raw SQL, mysql2 — no ORM)
- **Auth**: JWT (httpOnly cookie) + bcrypt
- **AI Chatbot**: Google Generative AI — Gemma 4 (agentic loop)
- **Bill Scanning**: Google Generative AI (Gemini)
- **Telegram Bot**: node-telegram-bot-api
- **Email**: Resend + Nodemailer
- **Dev**: nodemon

## Installation

```bash
cd backend
npm install
```

Create `.env`:

```env
PORT=9999
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fintra_db

JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d

RESEND_API_KEY=your_resend_api_key
SENDER_EMAIL=noreply@fintra.app

GEMINI_API_KEY=your_google_generative_ai_key

# Optional — omit to disable Telegram bot
TELEGRAM_BOT_API=your_telegram_bot_token
```

## Scripts

```bash
npm run dev    # Nodemon dev server — http://localhost:9999
npm start      # Production server
```

## Project Structure

```
backend/
├── config/
│   └── db.js                      # MySQL connection pool
├── controller/                    # Request/response handlers
│   ├── authController.js
│   ├── walletController.js
│   ├── transactionController.js
│   ├── budgetController.js
│   ├── debtController.js
│   ├── savingController.js
│   ├── transferController.js
│   ├── billController.js
│   ├── categoryController.js
│   ├── dashboardController.js
│   ├── chatControllerV3.js        # AI chatbot — agentic loop
│   └── telegramController.js      # Telegram bot handler
├── middleware/
│   └── authMiddleware.js          # JWT verification
├── model/                         # Raw SQL query functions
│   ├── userModel.js
│   ├── walletModel.js
│   ├── transactionModel.js
│   ├── budgetModel.js
│   ├── debtModel.js
│   ├── savingModel.js             # ⚠️ Complex withdrawal logic
│   ├── transferModel.js
│   ├── categoryModel.js
│   ├── chatModel.js
│   └── telegramModel.js
├── router/                        # Express route definitions
├── services/                      # Business logic & external services
│   ├── agentServiceV3.js          # Agentic ReAct loop (Google GenAI)
│   ├── chatService.js             # Shared chat processor (web + Telegram)
│   ├── financeService.js          # Core finance calculations
│   └── telegramLinkService.js     # Token-based account linking
├── utils/
│   ├── agentPromptV3.js           # AI system prompt builder
│   ├── agentToolsV3.js            # Tool definitions + executors
│   ├── chatFormatters.js          # Shared message formatters (DRY)
│   ├── sqlValidator.js            # SQL security: SELECT-only, table whitelist
│   └── promptsV2.js               # Shared prompt helpers, ALLOWED_TABLES
└── server.js                      # Entry point
```

## API Endpoints

### Auth — `/api/auth`
```
POST /register          Register new account (rate limit: 10/15min)
POST /verify-email      Verify OTP code (rate limit: 5/15min)
POST /login             Login → set JWT cookie (rate limit: 10/15min)
POST /refresh-token     Refresh access token
GET  /me                Get current user info (auth required)
POST /logout            Logout and clear cookie
POST /forgot-password   Request OTP for password reset
POST /reset-password    Reset password with OTP
```

### Wallets — `/api/wallets`
```
GET    /                List all wallets
POST   /                Create wallet
PUT    /:id             Update wallet
DELETE /:id             Delete wallet
```

### Transactions — `/api/transactions`
```
GET    /                List transactions (supports filtering)
POST   /                Create transaction (income/expense)
PUT    /:id             Update transaction
DELETE /:id             Delete transaction
```

### Transfers — `/api/transfers`
```
POST   /                Transfer between wallets
GET    /                Transfer history
```

### Budgets — `/api/budgets`
```
GET    /                List budgets
POST   /                Create budget
PUT    /:id             Update budget
DELETE /:id             Delete budget
```

### Savings — `/api/savings`
```
GET    /                List savings goals
POST   /                Create savings goal
GET    /reserved        Get locked balance per wallet
POST   /:id/contribute  Deposit from a wallet into a goal
POST   /:id/withdraw    Withdraw by contribution ratio per wallet ⚠️
POST   /:id/disburse    Disburse all funds back to source wallets
GET    /:id/history     Deposit/withdrawal history
DELETE /:id             Delete savings goal
```

### Debts — `/api/debts`
```
GET    /                List debts (lend/borrow)
POST   /                Create debt record
PUT    /:id             Update debt
DELETE /:id             Delete debt
```

### Categories — `/api/categories`
```
GET    /                List user categories
POST   /                Create category
PUT    /:id             Update category
DELETE /:id             Delete category
```

### Dashboard — `/api/dashboard`
```
GET    /                Summary: balance, income/expense, charts
```

### Bills — `/api/bills`
```
POST   /scan            Upload bill image → AI extract → create transaction
```

### Chat — `/api/chat`
```
GET    /sessions                          List chat sessions
POST   /sessions                          Create new session
GET    /sessions/:sessionId/messages      Get message history
POST   /sessions/:sessionId/messages      Send message → AI response
```

### Telegram — `/api/telegram`
```
POST   /link            Generate link token (10 min TTL)
DELETE /unlink          Unlink Telegram account
GET    /status          Check if account is linked
POST   /webhook         Telegram bot webhook (internal)
```

## Key Rules

### Ownership
Every query touching user data must filter by `user_id`:
```js
// ✅ Correct
const [rows] = await db.query(
  'SELECT * FROM wallets WHERE id = ? AND user_id = ?',
  [id, userId]
);
```

### SQL Safety
Always use parameterized queries — never string concatenation:
```js
// ❌ SQL injection risk
db.query(`SELECT * FROM wallets WHERE id = ${id}`);

// ✅ Safe
db.query('SELECT * FROM wallets WHERE id = ?', [id]);
```

### Savings Withdrawal
The withdrawal logic in `savingModel.js` is complex — users can only withdraw funds proportional to their contributions per wallet. **Do not modify** this logic without fully understanding the contribution ratio mechanism.

### Error Response Format
```js
// All errors follow this shape
{ message: 'Human-readable error description' }
```

### Environment Variables

| Variable | Description | Required |
|---|---|---|
| `PORT` | Server port | No (default: 9999) |
| `DB_HOST` | MySQL host | Yes |
| `DB_USER` | Database user | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `DB_NAME` | Database name | Yes |
| `JWT_SECRET` | JWT signing key | Yes |
| `JWT_EXPIRE` | Token expiry | No (default: 7d) |
| `RESEND_API_KEY` | Email service key | Yes |
| `SENDER_EMAIL` | From email address | Yes |
| `GEMINI_API_KEY` | Google Generative AI key | Yes |
| `TELEGRAM_BOT_API` | Telegram bot token | No (disables bot if absent) |
