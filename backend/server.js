// Disable verbose logging and tips from dotenv v17 (dotenvx)
process.env.DOTENV_LOG_LEVEL = 'none';
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
// import Routes
const authRoute = require("./router/authRoute");
const walletRoute = require("./router/walletRoute");
const categoryRoute = require("./router/categoryRoute");
const transactionRoute = require("./router/transactionRoute");
const debtRoute = require("./router/debtRoute");
const transferRoute = require("./router/transferRoute");
const savingRoute = require("./router/savingRoute");
const budgetRoute = require("./router/budgetRoute");
const dashboardRoute = require("./router/dashboardRoute");
const chatRoute = require("./router/chatRoute");
const billRoute = require("./router/billRoute");
const telegramRoute = require("./router/telegramRoute");
const { initTelegramBot } = require("./controller/telegramController");

const db = require("./config/db");
const initDatabase = require("./config/dbInit");
const app = express();

// Trust reverse proxy (Cloudflare Tunnel / Nginx) to extract real client IP in rate-limiters
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(morgan("dev"));
app.use(cookieParser());

app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use("/api/auth", authRoute);
app.use("/api/wallets", walletRoute);
app.use("/api/categories", categoryRoute);
app.use("/api/transactions", transactionRoute);
app.use("/api/debts", debtRoute);
app.use("/api/transfers", transferRoute);
app.use("/api/savings", savingRoute);
app.use("/api/budgets", budgetRoute);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/chat", chatRoute);
app.use("/api/bills", billRoute);
app.use("/api/telegram", telegramRoute);

// ── Global error handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('[GlobalError]', err.message || err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error'),
    });
});

const PORT = process.env.PORT || 9999;

// Run automatic database schema migration, then start the server
initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            initTelegramBot();
        });
    })
    .catch((err) => {
        console.error('Fatal error during database migration. Application cannot start:', err);
        process.exit(1);
    });

module.exports = app;
