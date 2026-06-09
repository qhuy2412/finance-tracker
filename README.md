# FinTra — Finance Tracker

A personal finance management app: track wallets, transactions, budgets, debts, savings goals, scan bills with AI, and get financial advice from an AI chatbot — including a Telegram bot integration.

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 Authentication | Register, login, OTP via email, forgot password |
| 💼 Wallet Management | Multiple wallets, balance tracking, transfers |
| 💸 Transactions | Record income/expenses, categorize, filter |
| 📊 Budgets | Spending limits per category and period |
| 🏦 Savings Goals | Create goals, deposit from multiple wallets, withdraw by contribution ratio |
| 📋 Debts | Track money lent and borrowed |
| 🧾 Bill Scanning | Upload bill photo → AI extracts data → auto-create transaction |
| 🤖 AI Chatbot (Web) | Financial advice, query your data in natural language |
| 📱 Telegram Bot | Same AI brain accessible via Telegram — link account from Settings |
| 📈 Dashboard | Income/expense charts, balance overview, trends |
| 🔔 Notifications | Daily transaction alerts, budget alerts, savings milestones, and weekly reports |
| 📊 Weekly Reports | AI-generated financial insights, weekly breakdowns, and category charts |

## 🚀 Quick Start

### Requirements
- Node.js 18+
- MySQL 8+
- npm

### Run via Docker (Recommended / Easiest)

You can run the entire FinTra stack (MySQL database, Express backend, and React frontend) using Docker Compose:

```bash
# Start all containers in the background
docker compose up -d --build
```

- **Frontend**: [http://localhost:80](http://localhost:80)
- **Backend API**: [http://localhost:9999](http://localhost:9999)
- **Database**: Port `3306` (credentials: `root` / `fintra_root_password`)
- **Logs**: Mounted to `./backend/logs/` and streamed to stdout

### Manual Installation (Local Dev)

```bash
# Clone the repo
git clone https://github.com/qhuy2412/finance-tracker.git
cd FinTra

# Install backend
cd backend && npm install

# Install frontend
cd ../frontend && npm install
```

### Environment Setup

**Backend** — create `backend/.env`:
```env
PORT=9999
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fintra_db

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

# Cron Scheduler Config (optional)
DAILY_ALERT_HOUR=21
WEEKLY_REPORT_DAY=0
WEEKLY_REPORT_HOUR=20
```

**Frontend** — create `frontend/.env`:
```env
VITE_API_URL=http://localhost:9999
```

### Run Development

```bash
# Terminal 1 — Backend (http://localhost:9999)
cd backend && npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend && npm run dev
```

## 🗂 Project Structure

```
FinTra/
├── backend/            # Express API (Node.js + MySQL)
│   ├── config/         # Database connection & schema migration script
│   ├── controller/     # Request handlers (e.g. notifications, reports, logs)
│   ├── middleware/     # Auth (JWT), rate limiting
│   ├── model/          # Raw SQL queries
│   ├── router/         # Express API route definitions
│   ├── services/       # External services (AI Agent loop, email, Telegram, scheduler)
│   ├── utils/          # Helpers, AI prompts, SQL validator, JSONL logger
│   └── server.js       # Entry point & app setup
├── frontend/           # React 19 (Vite + Tailwind CSS v4)
│   └── src/
│       ├── components/ # Shared UI components (NotificationBell, ChatWidget)
│       ├── pages/      # Route-level page components (dashboard, reports, wallets)
│       ├── services/   # Axios API wrappers (notification, report services)
│       ├── store/      # React Context state management
│       └── utils/      # Helpers
├── tests/              # Integration & exploratory tests (PinchTab)
├── .agents/            # AI agent workspace rules & workflows
│   ├── rules/          # Code quality, backend, frontend rules
│   └── workflows/      # Dev workflows (commit, review, debug...)
├── docker-compose.yml  # Local multi-container development stack configuration
├── docker-compose.prod.yml # Production multi-container deployment configuration
└── GEMINI.md           # AI agent project context
```

## 🔌 API Overview

| Prefix | Description |
|---|---|
| `POST /api/auth/*` | Register, login, OTP, logout |
| `GET/POST/PUT/DELETE /api/wallets` | Wallet management |
| `GET/POST/PUT/DELETE /api/transactions` | Transactions |
| `POST /api/transfers` | Transfer between wallets |
| `GET/POST/PUT/DELETE /api/budgets` | Budgets |
| `GET/POST /api/savings` | Savings goals |
| `POST /api/savings/:id/contribute` | Deposit to a goal |
| `POST /api/savings/:id/withdraw` | Withdraw by contribution ratio |
| `POST /api/savings/:id/disburse` | Disburse all funds back to wallets |
| `GET/POST/PUT/DELETE /api/debts` | Debt tracking |
| `GET/PATCH /api/notifications/*` | Notification fetch, unread counts, and reading status |
| `GET /api/reports/weekly` | Get weekly financial report details & AI analysis |
| `GET /api/dashboard` | Dashboard summary |
| `POST /api/bills/scan` | AI bill scanning |
| `GET/POST /api/chat/sessions` | Chat session management |
| `POST /api/chat/sessions/:id/messages` | Send message to AI chatbot |
| `POST /api/telegram/link` | Link Telegram account |
| `DELETE /api/telegram/unlink` | Unlink Telegram account |
| `GET /api/telegram/status` | Get Telegram link status |

## 🛠 Tech Stack

### Frontend
- **React 19** + Vite 8
- **Tailwind CSS v4** + shadcn/ui (Base UI)
- **React Context API** — state management
- **Axios** — HTTP client
- **Recharts** — data visualization
- **react-router-dom v7** — routing

### Backend
- **Express v5** + Node.js (CommonJS)
- **MySQL** + mysql2 (raw SQL, no ORM)
- **JWT** (httpOnly cookie) + bcrypt
- **Google Generative AI** (Gemini) — ReAct loop agent + chatbot + bill scan
- **node-cron** — daily and weekly scheduler integration
- **node-telegram-bot-api** — Telegram bot integration
- **Resend** + Nodemailer — email
- **Custom Logger** — JSONL action log + chatbot trace logger

## 🔐 Security

- JWT stored in **httpOnly cookie** — not accessible from JavaScript
- All SQL queries use **parameterized queries** (`?`) — no SQL injection
- Every API endpoint enforces **ownership checks** (`WHERE user_id = ?`)
- LLM-generated SQL is validated (SELECT only) before execution
- Distributed lock synchronization via MySQL advisory locks (`GET_LOCK`) for background jobs
- Rate limiting on auth routes (10 req / 15 min)
- Payload limit: 10MB (for bill scan base64)

## 📝 License

MIT