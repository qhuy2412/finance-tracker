# FinTra — Backend API

REST API for the FinTra personal finance management app. Built with Express v5 + MySQL, with AI integrations (Google Generative AI / Gemini) and Telegram bot support.

## Tech Stack

- **Runtime**: Node.js (CommonJS)
- **Framework**: Express v5
- **Database**: MySQL 8 (raw SQL, mysql2 — no ORM)
- **Auth**: JWT (httpOnly cookie) + bcrypt
- **AI Chatbot**: Google Generative AI — ReAct Agent Loop (Gemini 2.5 Flash)
- **Bill Scanning**: Google Generative AI (Gemini)
- **Scheduler**: node-cron (background cron worker processes)
- **Telegram Bot**: node-telegram-bot-api
- **Email**: Resend + Nodemailer
- **Logging**: JSONL activity logging + human-readable chatbot trace log
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

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fintra_db
DB_PORT=3306
DB_SSL=false

# Auth
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
SENDER_EMAIL=noreply@fintra.app

# AI
GEMINI_API_KEY=your_google_generative_ai_key

# Telegram Bot (optional)
TELEGRAM_BOT_API=your_telegram_bot_token

# Background Scheduler (optional)
DAILY_ALERT_HOUR=21
WEEKLY_REPORT_DAY=0
WEEKLY_REPORT_HOUR=20
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
│   ├── db.js                      # MySQL connection pool & client connection test
│   └── schema.sql                 # Complete MySQL schema & seed categories
├── controller/                    # Request/response handlers
│   ├── authController.js          # Auth operations & OTP checks
│   ├── walletController.js        # Wallet CRUD
│   ├── transactionController.js   # Transaction CRUD & filter
│   ├── budgetController.js        # Budget CRUD & progress checks
│   ├── debtController.js          # Debt tracking operations
│   ├── savingController.js        # Saving goal allocations
│   ├── transferController.js      # Internal transfer operations
│   ├── billController.js          # AI bill OCR scanning controller
│   ├── categoryController.js      # Category listing & creation
│   ├── dashboardController.js     # Unified financial metrics & stats
│   ├── chatControllerV3.js        # AI chatbot ReAct loop controller
│   ├── telegramController.js      # Telegram bot update handlers
│   └── notificationController.js  # Notifications retrieval and read status
├── middleware/
│   ├── authMiddleware.js          # JWT authentication checks & cookie extraction
│   └── rateLimit.js               # Rate limiting middleware for sensitive routes
├── model/                         # Raw SQL query functions (no ORM)
│   ├── userModel.js               # Users DB interactions
│   ├── walletModel.js             # Wallets DB interactions
│   ├── transactionModel.js        # Transactions DB interactions
│   ├── budgetModel.js             # Budgets DB interactions
│   ├── debtModel.js               # Debts DB interactions
│   ├── savingModel.js             # Savings DB interactions (proportional withdrawals)
│   ├── transferModel.js           # Transfers DB interactions
│   ├── categoryModel.js           # Categories DB interactions
│   ├── chatModel.js               # Chat sessions & messages DB interactions
│   ├── telegramModel.js           # Telegram account mapping queries
│   └── notificationModel.js       # Notification persistence models
├── router/                        # Express route definitions
│   ├── authRoute.js
│   ├── walletRoute.js
│   ├── transactionRoute.js
│   ├── transferRoute.js
│   ├── budgetRoute.js
│   ├── savingRoute.js
│   ├── debtRoute.js
│   ├── categoryRoute.js
│   ├── dashboardRoute.js
│   ├── chatRoute.js
│   ├── billRoute.js
│   ├── telegramRoute.js
│   └── notificationRoute.js       # /api/notifications routing
├── services/                      # Business logic & external integrations
│   ├── agentServiceV3.js          # Web chatbot ReAct loop with Gemini
│   ├── chatService.js             # Shared chat process logic (web + telegram)
│   ├── financeService.js          # Specialized budget progress calculations
│   ├── telegramLinkService.js     # Token verification for account linking
│   ├── schedulerService.js        # node-cron initialization & job registration
│   └── notificationAgentService.js# Daily alert and weekly Gemini ReAct report generation
├── utils/
│   ├── agentPromptV3.js           # Chatbot persona system prompt
│   ├── agentToolsV3.js            # Chatbot database access tool declarations
│   ├── chatFormatters.js          # Shared Markdown formatters
│   ├── emailService.js            # Resend OTP sender service
│   ├── logger.js                  # User actions and chatbot cost/trace logger
│   ├── notificationAgentPrompt.js # Weekly report writer LLM system instructions
│   ├── notificationAgentTools.js  # Weekly report database access tool declarations
│   ├── prompts.js                 # Shared LLM instructions
│   ├── promptsV2.js               # Database schema prompt helper & tables whitelist
│   └── sqlValidator.js            # Strict SQL SELECT-only validator
└── server.js                      # App entry point, cron boot, Telegram hook mapping
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

### Notifications — `/api/notifications`
```
GET    /                List all notifications
GET    /unread-count    Get unread notification count
PATCH  /read-all        Mark all notifications as read
PATCH  /:id/read        Mark a notification as read
```

## 🗓 Background Scheduler (Cron Jobs)

FinTra includes an automated background cron scheduler (`schedulerService.js`) initialized upon backend server start. It registers two core background tasks (running in the `Asia/Ho_Chi_Minh` timezone):
1. **Daily Transaction Alert** (`checkMissingTransactions`): Runs daily at `DAILY_ALERT_HOUR` (default: 21:00). It queries the transaction database. If a user has not logged any transaction for the current day, it generates a `MISSING_TRANSACTION` alert notification.
2. **Weekly Financial Report** (`runWeeklyReports`): Runs weekly at `WEEKLY_REPORT_DAY` / `WEEKLY_REPORT_HOUR` (default: Sunday at 20:00). This task runs a Gemini 2.5 Flash agent loop for each user in parallel batches. The agent analyzes the user's weekly income/expense totals, budget limits, savings goals, and debts due soon, writes a JSON structured weekly report, and appends a personalized AI advisory feedback comment.

**Atomic Execution**: Both background cron jobs utilize atomic `INSERT IGNORE` queries into the `cron_run_log` table with a `UNIQUE(job_name, run_date)` constraint to ensure jobs only execute on a single server instance in clustered or containerized deployments.

## 📝 Logging & Diagnostics System

All backend activities and chatbot traces are tracked via a custom logging system (`utils/logger.js`) in `backend/logs/`:
- **User Activity (`user_activity.log`)**: Logged in JSONL format. Records user actions (e.g. `LOGIN`, `CREATE_TRANSACTION`, `DELETE_BUDGET`), complete with client IP address (trusts proxy headers) and user-agent.
- **Chatbot Activity (`chatbot_agent.log`)**: Logged in JSONL format. Stores chatbot session messaging data, execution response time, input/output token count usage, and chatbot USD cost estimations based on Gemini token pricing.
- **Chatbot Traces (`chatbot_trace.log`)**: Human-readable trace log depicting the chatbot's ReAct agent loops step-by-step (e.g. what tools were called, args sent, SQL queries executed, and raw database responses returned).

## 🛠 Key Rules

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

## ⚙️ Environment Variables

| Variable | Description | Required | Default |
|---|---|---|---|
| `PORT` | Backend server port | No | `9999` |
| `NODE_ENV` | Environment mode (`development` / `production`) | No | `development` |
| `DB_HOST` | MySQL database host | Yes | - |
| `DB_USER` | MySQL database username | Yes | - |
| `DB_PASS` | MySQL database password | Yes | - |
| `DB_NAME` | MySQL database name | Yes | - |
| `DB_PORT` | MySQL database port | No | `3306` |
| `DB_SSL` | Enable SSL for MySQL connection (`true` / `false`) | No | `false` |
| `JWT_SECRET_KEY` | JWT signature secret key for access token | Yes | - |
| `JWT_TOKEN_SECRET` | JWT signature secret key for refresh token | Yes | - |
| `RESEND_API_KEY` | Email service (Resend) API key | Yes | - |
| `SENDER_EMAIL` | From email sender address for OTP emails | Yes | - |
| `GEMINI_API_KEY` | Google Generative AI (Gemini) API key | Yes | - |
| `TELEGRAM_BOT_API` | Telegram Bot API authorization token | No | `(Disabled if omitted)` |
| `DAILY_ALERT_HOUR` | Daily transaction check hour (0-23, VN time) | No | `21` |
| `WEEKLY_REPORT_DAY` | Weekly report day of week (0=Sunday ... 6=Saturday) | No | `0` (Sunday) |
| `WEEKLY_REPORT_HOUR` | Weekly report generate hour (0-23, VN time) | No | `20` |
