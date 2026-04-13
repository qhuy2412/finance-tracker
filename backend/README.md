# FinTra Backend

Express.js-based REST API for a comprehensive financial management application. Provides authentication, wallet management, transaction tracking, budgeting, and AI-powered financial assistance.

## 🚀 Features

- **Authentication**: User registration, login with JWT and email verification via OTP
- **User Management**: Secure password hashing with bcrypt
- **Wallet Management**: Create and manage multiple wallets
- **Transaction Tracking**: Record and categorize financial transactions
- **Budget Planning**: Set budgets and track spending
- **Debt Management**: Track debts and repayment schedules
- **Savings Goals**: Set and monitor savings targets
- **Bill Management**: Track bills and due dates
- **Money Transfers**: Transfer funds between accounts with settlement tracking
- **Categories**: Predefined transaction categories
- **AI Integration**: Gemini and Groq API integration for financial advice
- **Email Services**: OTP verification and notifications via Resend
- **Error Handling**: Custom error responses with field-level validation

## 📋 Prerequisites

- Node.js 14+ and npm
- MySQL database
- Environment variables configured

## 🔧 Installation

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**
   Create a `.env` file:
   ```env
   # Server
   PORT=5000
   NODE_ENV=development

   # Database
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=fintra_db

   # JWT
   JWT_SECRET=your_jwt_secret_key
   JWT_REFRESH_SECRET=your_refresh_secret_key
   JWT_EXPIRE=7d

   # Email (Resend)
   RESEND_API_KEY=your_resend_api_key
   SENDER_EMAIL=noreply@fintra.app

   # AI APIs
   GOOGLE_API_KEY=your_google_generative_ai_key
   GROQ_API_KEY=your_groq_api_key

   # CORS
   CORS_ORIGIN=http://localhost:5173
   ```

3. **Setup database**
   Create MySQL database and import schema (if available)

## 🎯 Available Scripts

### Development Server
```bash
npm run dev
```
Starts the server with nodemon for hot reload at `http://localhost:5000`

### Production Server
```bash
npm start
```
Runs the server in production mode

## 📁 Project Structure

```
backend/
├── config/
│   └── db.js                    # Database connection configuration
├── controller/                  # Route handlers
│   ├── authController.js        # Authentication logic
│   ├── walletController.js      # Wallet operations
│   ├── transactionController.js # Transaction management
│   ├── budgetController.js      # Budget operations
│   ├── debtController.js        # Debt tracking
│   ├── savingController.js      # Savings goals
│   ├── transferController.js    # Money transfers
│   ├── billController.js        # Bill management
│   ├── categoryController.js    # Categories
│   ├── dashboardController.js   # Dashboard data
│   └── chatController.js        # AI chat interface
├── middleware/
│   └── authMiddleware.js        # JWT verification and authorization
├── model/                       # Database models
│   ├── userModel.js
│   ├── walletModel.js
│   ├── transactionModel.js
│   ├── budgetModel.js
│   ├── debtModel.js
│   ├── savingModel.js
│   ├── transferModel.js
│   ├── billModel.js
│   ├── categoryModel.js
│   └── chatModel.js
├── router/                      # API route definitions
│   ├── authRoute.js
│   ├── walletRoute.js
│   ├── transactionRoute.js
│   ├── budgetRoute.js
│   ├── debtRoute.js
│   ├── savingRoute.js
│   ├── transferRoute.js
│   ├── billRoute.js
│   ├── categoryRoute.js
│   ├── dashboardRoute.js
│   └── chatRoute.js
├── services/                    # Business logic and utilities
│   ├── financeService.js        # Core finance operations
│   ├── budgetFinance.service.js # Budget calculations
│   ├── transactionFinance.service.js # Transaction logic
│   ├── debtFinance.service.js   # Debt calculations
│   ├── savingFinance.service.js # Savings logic
│   ├── transferFinance.service.js # Transfer operations
│   ├── walletFinance.service.js # Wallet operations
│   ├── categoryFinance.service.js # Category management
│   ├── financeEntityResolver.js # Entity relationship resolver
│   └── financeErrors.js         # Custom error definitions
├── utils/
│   ├── emailService.js          # Email sending utility
│   └── prompts.js               # AI prompt templates
├── .env                         # Environment variables
├── .gitignore
├── package.json
├── server.js                    # Entry point
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-email` - Verify email with OTP
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh-token` - Refresh JWT token
- `GET /api/auth/me` - Get current user info

### Wallets
- `GET /api/wallet` - Get all wallets
- `POST /api/wallet` - Create wallet
- `GET /api/wallet/:id` - Get wallet details
- `PUT /api/wallet/:id` - Update wallet
- `DELETE /api/wallet/:id` - Delete wallet

### Transactions
- `GET /api/transaction` - Get all transactions
- `POST /api/transaction` - Create transaction
- `GET /api/transaction/:id` - Get transaction details
- `PUT /api/transaction/:id` - Update transaction
- `DELETE /api/transaction/:id` - Delete transaction

### Budgets
- `GET /api/budget` - Get all budgets
- `POST /api/budget` - Create budget
- `PUT /api/budget/:id` - Update budget
- `DELETE /api/budget/:id` - Delete budget

### Debts
- `GET /api/debt` - Get all debts
- `POST /api/debt` - Create debt record
- `PUT /api/debt/:id` - Update debt
- `DELETE /api/debt/:id` - Delete debt

### Savings
- `GET /api/saving` - Get all savings goals
- `POST /api/saving` - Create savings goal
- `PUT /api/saving/:id` - Update savings goal
- `DELETE /api/saving/:id` - Delete savings goal

### Transfers
- `GET /api/transfer` - Get all transfers
- `POST /api/transfer` - Create transfer

### Bills
- `GET /api/bill` - Get all bills
- `POST /api/bill` - Create bill
- `PUT /api/bill/:id` - Update bill
- `DELETE /api/bill/:id` - Delete bill

### Categories
- `GET /api/category` - Get all categories
- `POST /api/category` - Create category

### Dashboard
- `GET /api/dashboard` - Get dashboard summary

### Chat AI
- `POST /api/chat` - Send message to AI assistant

## 🔐 Authentication

Uses JWT (JSON Web Tokens) for stateless authentication:

1. User registers and email is verified via OTP
2. Login returns JWT token stored in HTTP-only cookies
3. Token required for protected endpoints via middleware
4. Token expires based on `JWT_EXPIRE` setting
5. Refresh token can be used to get new access token

## 🛠 Technologies

- **Express.js**: Web framework
- **MySQL2**: Database driver
- **JWT**: Token-based authentication
- **bcrypt**: Password hashing
- **Nodemailer & Resend**: Email sending
- **Google Generative AI**: AI powered financial advice
- **Groq SDK**: Alternative AI API
- **Morgan**: HTTP request logging
- **CORS**: Cross-origin resource sharing
- **UUID**: Unique identifier generation

## 🧠 AI Integration

The backend integrates with AI providers for financial advice:

- **Google Generative AI (Gemini)**: Primary AI provider
- **Groq API**: Alternative/fallback AI provider
- Custom prompts for financial advice and analysis

## ✅ Error Handling

Custom error handling system with:
- Field-level validation errors
- Standardized error response format
- HTTP status code mapping
- Error logging and tracking

## 📊 Database Schema

The database includes tables for:
- Users (authentication and profile)
- Wallets (account management)
- Transactions (income/expense records)
- Budgets (spending limits)
- Debts (liability tracking)
- Savings (goal tracking)
- Transfers (money movements)
- Bills (recurring payments)
- Categories (transaction classification)
- Chat History (AI conversations)

## 🔄 Service Layer

The `services/` directory contains business logic:
- **financeService.js**: Core operations
- **Finance*Service.js**: Feature-specific calculations
- **financeEntityResolver.js**: Cross-entity operations
- **financeErrors.js**: Custom error definitions

## 🚀 Deployment

1. Set all required environment variables
2. Ensure MySQL database is accessible
3. Install dependencies: `npm install`
4. Run server: `npm start`
5. Deploy to your server (Heroku, AWS, DigitalOcean, etc.)

## 🔒 Security Considerations

- Passwords are hashed with bcrypt (10 salt rounds)
- JWT tokens signed with secret key
- HTTP-only cookies prevent XSS attacks
- CORS configured to allow only trusted origins
- Input validation on all endpoints
- Error messages don't expose sensitive information

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Server port | No (default: 5000) |
| DB_HOST | MySQL host | Yes |
| DB_USER | Database user | Yes |
| DB_PASSWORD | Database password | Yes |
| DB_NAME | Database name | Yes |
| JWT_SECRET | JWT signing key | Yes |
| RESEND_API_KEY | Email service key | Yes |
| GOOGLE_API_KEY | Gemini API key | No |
| GROQ_API_KEY | Groq API key | No |
| CORS_ORIGIN | Frontend URL | No |

## 🐛 Troubleshooting

- **Database connection error**: Check DB credentials in `.env`
- **Email not sending**: Verify Resend API key and sender email
- **JWT errors**: Ensure JWT_SECRET is set and consistent
- **AI endpoints failing**: Check Google/Groq API keys
- **CORS errors**: Update CORS_ORIGIN in environment

## 📞 Support

For issues or questions, check the main project README or contact the development team.
