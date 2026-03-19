import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/AuthContext";
import AuthPage from "./pages/auth/AuthPage";
import Dashboard from "./pages/dashboard/Dashboard";
import Layout from "./components/common/Layout";
import Wallets from "./pages/wallet/Wallet";
import Transactions from "./pages/transaction/Transactions";
import Debts from "./pages/debt/Debts";
import Budgets from "./pages/budget/Budgets";
import Savings from "./pages/saving/Savings";
import Transfers from "./pages/transfer/Transfers";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  
  return user ? children : <Navigate to="/auth" replace />;
};

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />} />
        <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/dashboard" replace />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/wallets" element={<Wallets/>} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/transfers" element={<Transfers />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}