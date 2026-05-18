# Workspace Rules — FinTra (Antigravity)

---

## 1. Product Overview

- **Product name**: FinTra — Finance Tracker
- **Description**: A personal finance management app supporting wallet tracking, transactions, budgets, debts, savings goals, and an AI financial advisor chatbot
- **Stage**: Beta
- **Target users**: B2C end-users (individuals managing personal finances)

### Environments
| Environment | URL | Notes |
|---|---|---|
| Local Frontend | http://localhost:5173 | Vite dev server |
| Local Backend | http://localhost:9999 | Express API |
| Production | TBD | Requires approval before deploying |

---

## 2. Tech Stack

### Frontend
- Framework: **React 19** (Vite)
- Styling: **Tailwind CSS v4** + shadcn/ui (Base UI)
- State management: **Zustand** (`src/store/`)
- HTTP client: **Axios** (`src/services/`)
- UI components: `lucide-react`, `recharts`, `react-toastify`
- Package manager: npm
- Directory: `./frontend/src/`

### Backend
- Runtime: **Node.js** (CommonJS)
- Framework: **Express v5**
- Database: **MySQL** (mysql2)
- ORM: Raw SQL queries (no ORM)
- Authentication: **JWT** (httpOnly cookie) + bcrypt
- AI: **Google Generative AI** (agentic chatbot + bill scanning)
- Email: **Resend** + Nodemailer
- API style: **REST**
- Directory: `./backend/`

### Infrastructure
- CI/CD: **GitHub Actions** (`.github/`)
- Database: MySQL (self-hosted / cloud)
- File storage: None (base64 for bill scanning)

---

## 3. Directory Structure

```
FinTra/
├── frontend/
│   ├── src/
│   │   ├── components/     # Shared UI components (shadcn/ui based)
│   │   ├── pages/          # Route-level pages
│   │   ├── services/       # Axios API calls
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
│   ├── model/              # Raw SQL query functions (not ORM)
│   │   ├── userModel.js
│   │   ├── walletModel.js
│   │   ├── transactionModel.js
│   │   ├── budgetModel.js
│   │   ├── savingModel.js
│   │   ├── debtModel.js
│   │   ├── transferModel.js
│   │   ├── categoryModel.js
│   │   ├── chatModel.js
│   │   └── telegramModel.js
│   ├── router/             # Express route definitions
│   ├── services/           # External services (AI, email, Telegram)
│   ├── utils/              # LLM system prompts, SQL validator, helpers
│   ├── server.js           # Entry point, middleware setup
│   └── package.json
├── tests/                  # Test files
├── .github/                # GitHub Actions CI/CD
├── GEMINI.md               # This file — AI agent workspace rules
└── README.md
```

---

## 4. Code Conventions

### Naming
- Components: PascalCase — `WalletCard.jsx`, `TransactionList.jsx`
- Pages: PascalCase — `Dashboard.jsx`, `Savings.jsx`
- Services/utils: camelCase — `apiService.js`, `formatDate.js`
- API routes: kebab-case — `/api/wallets`, `/api/savings`
- Database tables: snake_case — `users`, `wallets`, `transactions`, `saving_goals`
- Backend model functions: camelCase — `getUserById()`, `createWallet()`

### Imports
- Frontend: relative imports from `src/` (no `@/` alias configured)
- Backend: CommonJS `require()`, no ES Modules

### Styling
- Tailwind CSS v4 utility classes
- shadcn/ui components (Base UI, not Radix)
- No inline styles; no separate CSS files unless for complex animations

### JavaScript (no TypeScript)
- Backend: CommonJS, no type checking
- Frontend: JSX (not TSX), `jsconfig.json` for IDE support
- Wrap all async operations in try/catch

---

## 5. Core Features & Business Logic

### Auth
- Description: Register, login, logout, forgot password (OTP via email)
- Files: `router/authRoute.js`, `controller/authController.js`, `model/userModel.js`
- API: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- Note: JWT stored in httpOnly cookie — never in localStorage

### Wallet
- Description: Create/edit/delete wallets, view balances, transfer between wallets
- Files: `router/walletRoute.js`, `controller/walletController.js`, `model/walletModel.js`
- API: `GET/POST/PUT/DELETE /api/wallets`, `POST /api/transfers`

### Transactions
- Description: Record income/expense, filter by category and date range
- Files: `router/transactionRoute.js`, `controller/transactionController.js`, `model/transactionModel.js`
- API: `GET/POST/PUT/DELETE /api/transactions`

### Budget
- Description: Set budgets per category, track spending vs. budget
- Files: `router/budgetRoute.js`, `controller/budgetController.js`, `model/budgetModel.js`
- API: `GET/POST/PUT/DELETE /api/budgets`

### Savings
- Description: Create savings goals, deposit from multiple wallets, withdraw/disburse proportionally
- Files: `router/savingRoute.js`, `controller/savingController.js`, `model/savingModel.js`
- API: `GET/POST/PUT /api/savings`, `POST /api/savings/:id/contribute`, `POST /api/savings/:id/withdraw`, `POST /api/savings/:id/disburse`
- Note: Withdrawal logic is complex — withdrawals are proportional to each wallet's contribution ratio

### Debt
- Description: Track debts (money lent to others / money borrowed from others)
- Files: `router/debtRoute.js`, `controller/debtController.js`, `model/debtModel.js`
- API: `GET/POST/PUT/DELETE /api/debts`

### AI Chatbot (Web)
- Description: Financial advisory chat, natural language DB queries (Google Generative AI)
- Files: `router/chatRoute.js`, `controller/chatControllerV3.js`, `services/agentServiceV3.js`, `utils/agentToolsV3.js`, `utils/agentPromptV3.js`
- API: `POST /api/chat/sessions/:sessionId/messages`
- Note: Agentic loop — LLM generates SQL → validate (SELECT only) → execute → return result

### Telegram Bot
- Description: Telegram chatbot linked to user account via token — same AI brain as web chatbot
- Files: `router/telegramRoute.js`, `controller/telegramController.js`, `services/telegramLinkService.js`, `services/chatService.js`
- API: `POST /api/telegram/link`, `DELETE /api/telegram/unlink`, `GET /api/telegram/status`
- Note: Linking uses short-lived tokens (10 min TTL); session history shared with web via DB

### Bill Scanning
- Description: Upload receipt image, AI extracts data, auto-creates a transaction
- Files: `router/billRoute.js`, `controller/billController.js`
- API: `POST /api/bills/scan`
- Note: Uses Google Generative AI (Gemini); images sent as base64 in request body

---

## 6. Database

### Schema Summary
```
users                — id, name, email, password_hash, created_at
wallets              — id, user_id (FK), name, balance, currency, icon, created_at
categories           — id, user_id (FK, NULL = system), name, type (income/expense), icon
transactions         — id, user_id, wallet_id, category_id, amount, type, note, transaction_date
transfers            — id, user_id, from_wallet_id, to_wallet_id, amount, note, transfer_date
saving_goals         — id, user_id, name, target_amount, current_amount, deadline, status
saving_contributions — id, saving_goal_id, wallet_id, amount, type (contribute/withdraw)
budgets              — id, user_id, category_id, amount, period, start_date, end_date
debts                — id, user_id, name, amount, type (lend/borrow), due_date, status
chat_sessions        — id, user_id, title, created_at, updated_at
chat_messages        — id, session_id, role, content, created_at
telegram_accounts    — id, user_id (FK), telegram_chat_id, linked_at
```

### Rules
- Never drop a column that has data — use soft delete if needed
- Every schema change must include a migration script
- Back up the DB before any production schema changes
- Raw SQL only — no ORM; always use parameterized queries (`?` placeholders) to prevent SQL injection

---

## 7. Common Commands

```bash
# Start dev servers
cd backend && npm run dev       # Backend: http://localhost:9999 (nodemon)
cd frontend && npm run dev      # Frontend: http://localhost:5173 (Vite)

# Build frontend
cd frontend && npm run build    # Output: frontend/dist/

# Lint frontend
cd frontend && npm run lint     # ESLint

# Preview production build
cd frontend && npm run preview
```

---

## 8. Browser Testing Rules

### Flows to test after every significant change
1. **Auth flow**: Register → Login → Logout → Forgot password (OTP)
2. **Wallet flow**: Create wallet → View balance → Transfer between wallets
3. **Transaction flow**: Add income/expense → Filter by category → View dashboard
4. **Savings flow**: Create goal → Deposit from multiple wallets → Withdraw → Disburse
5. **Chatbot flow**: Ask financial overview → Query transactions → Query budgets
6. **Bill scan flow**: Upload receipt image → Review extracted data → Create transaction
7. **Telegram flow**: Generate token in Settings → `/link <token>` in bot → Verify linked status

### Test accounts
- (Note: do not commit this to Git — store locally only)
- Create accounts via the normal registration flow when testing

---

## 9. Known Issues & Gotchas

- **CORS**: Currently `origin: true` (allows all origins) — must be restricted before production
- **Savings withdrawal**: Complex logic based on per-wallet contribution ratio — do not modify arbitrarily
- **SQL injection**: Models use raw SQL — always use `?` parameterized queries, never string concatenation
- **LLM SQL generation**: Chatbot-generated SQL must be validated (SELECT only) before execution
- **Base64 images**: Bill scan sends base64 in the request body — payload limit is `10mb` in `server.js`, do not increase
- **JWT cookie**: httpOnly cookie, not accessible from JS — no need to set `Authorization` header in frontend
- **Telegram sessions**: Session state is held in-memory (`Map`) — lost on server restart; session history persists in DB

---

## 10. Definition of Done

A task is considered complete when:
- [ ] Code implements the required logic correctly
- [ ] No JS runtime errors or ESLint warnings
- [ ] Tested in browser (with screenshots)
- [ ] No `console.log` or debug code left behind
- [ ] Commit message follows format: `type(scope): short description`
- [ ] No secrets exposed in code
- [ ] All API endpoints have ownership checks (users can only access their own data)

---

## 11. Decision Rules

### Always ask before doing
- Ambiguous requirements involving DB schema changes (add/edit/drop columns)
- Changes to savings withdrawal logic or balance calculation
- Adding a new npm dependency
- Modifying auth structure, JWT, or middleware
- Changing the response shape of an existing API endpoint (may break frontend)
- Any change affecting more than 3 files at once

### Do without asking
- Fix an obvious bug (typo, wrong display logic, wrong validation)
- Add input validation in a controller
- Refactor within a single file without changing its external interface
- Improve error messages or add comments

---

## 12. Hard Rules — Never Violate

1. **Never modify savings withdrawal logic** without clearly explaining the impact on contribution ratios
2. **Never use string concatenation in SQL** — always use `?` parameterized queries
3. **Never create a new route** without an ownership check (`WHERE user_id = ?`)
4. **Never store JWT in localStorage** — httpOnly cookie is the project standard
5. **Never commit `.env`** or any secrets to Git
6. **Never increase the payload limit** beyond `10mb` in `server.js`
7. **Never leave `console.log`** in code after debugging

---

## 13. Priority Order

When requirements conflict, prioritize in this order:

1. **Security** — ownership checks, SQL injection prevention, secret exposure
2. **Correctness** — accurate savings/budget calculation logic
3. **User experience** — no broken UI, errors displayed clearly
4. **Performance** — optimized queries, avoid N+1
5. **Code cleanliness** — naming, structure, comments

> See also: `backend/GEMINI.md` and `frontend/GEMINI.md` for layer-specific rules.