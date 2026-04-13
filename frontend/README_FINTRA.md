# FinTra Frontend

A modern React-based financial management dashboard built with Vite, Tailwind CSS, and Recharts. Provides a user-friendly interface for managing finances, budgets, transactions, and more.

## 🚀 Features

- **Authentication**: User registration, login with email verification
- **Dashboard**: Overview of financial statistics and trends
- **Wallet Management**: Add, update, and manage wallets
- **Transaction Tracking**: Record and categorize transactions
- **Budget Management**: Create and monitor budgets
- **Debt Tracking**: Track debts and repayments
- **Savings Goals**: Set and monitor savings targets
- **Bill Management**: Track upcoming bills and payments
- **Money Transfers**: Send money between accounts
- **Chat Widget**: AI-powered financial assistant
- **Real-time Notifications**: Toast notifications for user actions

## 📋 Prerequisites

- Node.js 16+ and npm
- Active backend API server

## 🔧 Installation

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment**
   Create a `.env` file (if needed):
   ```
   VITE_API_URL=http://localhost:5000
   ```

## 🎯 Available Scripts

### Development Server
```bash
npm run dev
```
Starts Vite development server with hot module replacement (HMR) at `http://localhost:5173`

### Production Build
```bash
npm run build
```
Creates optimized production build in the `dist/` directory

### Preview Build
```bash
npm run preview
```
Preview the production build locally

### Linting
```bash
npm run lint
```
Run ESLint to check code quality

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/          # Common layout components (Header, Layout, Chat)
│   │   ├── ui/              # Base UI components (Button, Input, Card, Label)
│   │   └── ConfirmModal.jsx # Confirmation modal
│   ├── pages/               # Page components by feature
│   │   ├── auth/            # Login/Register/OTP verification
│   │   ├── budget/          # Budget management
│   │   ├── dashboard/       # Dashboard overview
│   │   ├── debt/            # Debt tracking
│   │   ├── saving/          # Savings goals
│   │   ├── transaction/     # Transaction management
│   │   ├── transfer/        # Money transfers
│   │   └── wallet/          # Wallet management
│   ├── services/            # API integration services
│   │   ├── api.js           # Axios instance configuration
│   │   ├── authApi.js       # Authentication endpoints
│   │   ├── *.service.js     # Feature-specific API calls
│   ├── store/               # State management
│   │   └── AuthContext.jsx  # Authentication context
│   ├── utils/               # Utility functions
│   ├── lib/                 # Library helpers
│   ├── assets/              # Static assets
│   ├── App.jsx              # Root component
│   ├── App.css              # App styles
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Static public files
├── package.json
├── vite.config.js
├── eslint.config.js
├── postcss.config.js
└── README.md
```

## 🔌 API Integration

The frontend communicates with the backend API through service files:

- **Authentication**: `authApi.js` - login, register, email verification
- **Dashboard**: `dashboard.service.js` - financial summaries
- **Wallets**: `wallet.service.js` - wallet CRUD operations
- **Transactions**: `transaction.service.js` - transaction management
- **Budgets**: `budget.service.js` - budget planning
- **Categories**: `category.service.js` - transaction categories
- **Debts**: `debt.service.js` - debt tracking
- **Savings**: `saving.service.js` - savings goals
- **Transfers**: `transfer.service.js` - money transfers
- **Chat**: `chat.service.js` - AI assistant interaction

## 🎨 UI Components

Built with shadcn/ui and Tailwind CSS:

- **Button**: Versatile button component with variants
- **Input**: Text input with validation support
- **Card**: Content container with header/body/footer
- **Label**: Form label with accessibility support
- **ConfirmModal**: Confirmation dialog for critical actions

## 🔐 Authentication Flow

1. User registers with username, email, and password
2. OTP sent to email for verification
3. User verifies email with OTP code
4. User logs in with email and password
5. JWT token stored in cookies for session management

## 📊 Key Pages

| Page | Route | Purpose |
|------|-------|---------|
| Auth | `/auth` | Login, Register, Email Verification |
| Dashboard | `/dashboard` | Financial overview & statistics |
| Wallet | `/wallet` | Manage user wallets |
| Transactions | `/transactions` | View and manage transactions |
| Budget | `/budget` | Create and track budgets |
| Debt | `/debt` | Track debts and payments |
| Savings | `/saving` | Manage savings goals |
| Transfers | `/transfer` | Send money between accounts |

## 🛠 Technologies

- **React 19**: UI framework
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: React charting library
- **React Router**: Client-side routing
- **Axios**: HTTP client
- **React Toastify**: Toast notifications
- **React Base UI**: Accessible components

## 🔄 Error Handling

- Field-level error display on forms (registration)
- Toast notifications for general errors and success messages
- Validation before API calls
- Graceful error responses from API

## 🚀 Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy the `dist/` folder to your hosting service (Vercel, Netlify, AWS, etc.)

3. Configure environment variables in your hosting platform

## 📝 Notes

- The app requires a running backend server for full functionality
- Authentication tokens are stored in cookies
- All API requests include proper error handling
- Form validation includes both client-side and server-side checks
