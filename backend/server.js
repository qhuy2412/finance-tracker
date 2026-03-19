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

const db = require("./config/db");
const app = express();



app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

app.use(cors({
  origin: true, // Cho phép tất cả các nguồn để test trước
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
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


const PORT = process.env.PORT || 9999;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;

