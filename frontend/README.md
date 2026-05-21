# FinTra — Frontend

React 19 frontend for the FinTra personal finance management app. Built with Vite + Tailwind CSS v4.

## Tech Stack

- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS v4 + shadcn/ui (Base UI)
- **State**: React Context API (`src/store/`)
- **HTTP**: Axios via `src/services/api.js`
- **Charts**: Recharts
- **Routing**: react-router-dom v7
- **Notifications**: react-toastify

## Installation

```bash
cd frontend
npm install
```

Create `.env`:
```env
VITE_API_URL=http://localhost:9999
```

## Scripts

```bash
npm run dev      # Dev server — http://localhost:5173
npm run build    # Production build → dist/
npm run preview  # Preview production build
npm run lint     # ESLint check
```

## Project Structure

```
frontend/src/
├── components/
│   ├── common/          # Layout, Header, Sidebar, ChatWidget
│   └── ui/              # Button, Input, Card, Label, Modal (shadcn/ui)
├── pages/
│   ├── auth/            # Login, Register, OTP verification
│   ├── dashboard/       # Financial overview + charts
│   ├── wallet/          # Wallet management
│   ├── transaction/     # Income/expense transactions
│   ├── transfer/        # Wallet-to-wallet transfers
│   ├── budget/          # Budget planning
│   ├── saving/          # Savings goals
│   ├── debt/            # Debt tracking
│   └── settings/        # Account settings, Telegram linking
├── services/
│   ├── api.js           # Axios instance (baseURL, cookie, interceptors)
│   ├── authApi.js       # Auth endpoints
│   ├── wallet.service.js
│   ├── transaction.service.js
│   ├── transfer.service.js
│   ├── budget.service.js
│   ├── saving.service.js
│   ├── debt.service.js
│   ├── category.service.js
│   ├── dashboard.service.js
│   ├── chat.service.js
│   └── telegram.service.js
├── store/               # Auth Context (React Context API)
├── utils/               # Helpers, formatters
├── lib/                 # cn() utility (clsx + tailwind-merge)
├── App.jsx              # Router setup
└── main.jsx             # Entry point
```

## Pages

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Sign in |
| `/register` | Register | Sign up + OTP verification |
| `/dashboard` | Dashboard | Financial overview, charts |
| `/wallets` | Wallets | Manage wallets, view balances |
| `/transactions` | Transactions | Income/expense history, filters |
| `/transfers` | Transfers | Transfer between wallets |
| `/budgets` | Budgets | Budget tracking per category |
| `/savings` | Savings | Savings goals management |
| `/debts` | Debts | Track money lent and borrowed |
| `/settings` | Settings | Account settings, Telegram bot linking |

## Development Rules

### API Calls
- **Never** call `axios` directly in components — always use `services/*.service.js`
- Base URL comes from `import.meta.env.VITE_API_URL`
- Wrap in `try/catch`, display errors via `toast.error()`

```jsx
// ✅ Correct pattern
const handleSubmit = async () => {
  try {
    setLoading(true);
    await walletService.create(data);
    toast.success('Wallet created');
    refetch();
  } catch (err) {
    toast.error(err.response?.data?.message || 'Something went wrong');
  } finally {
    setLoading(false);
  }
};
```

### State Management

| State type | Use |
|---|---|
| Cross-page / shared data | React Context (AuthContext) |
| Local component UI state | `useState` |
| Derived from props | Compute inline — no state needed |

### Styling
- Use Tailwind utility classes
- Conditional classes: use `cn()` from `src/lib/`
- No inline `style={{}}` unless for dynamic values Tailwind can't handle

### Required UX Patterns
- **Loading states**: show spinner or skeleton while fetching
- **Empty states**: meaningful message when a list is empty
- **Destructive actions**: confirmation modal before delete
- **Forms**: disable submit button while loading to prevent double submit

## Auth Flow

1. User registers → receives OTP via email
2. Verify OTP → account activated
3. Login → JWT stored in **httpOnly cookie** (not readable from JS)
4. All requests automatically send cookie (`withCredentials: true` in `api.js`)
5. No need to manually set `Authorization` header
