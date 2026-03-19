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

// Config CORS
const corsOptions = {
  origin: 'http://localhost:5173', 
  
  credentials: true,
  
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
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

