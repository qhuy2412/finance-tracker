import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import ChatWidget from "./Chatwidget";
import {
  LayoutDashboard,
  Wallet,
  PiggyBank,
  LogOut,
  User,
  Bell,
  ChevronRight,
  ArrowLeftRight,
  HandCoins,
  Coins,
  History
} from "lucide-react";
import { useAuth } from "@/store/AuthContext";

const menuItems = [
  { icon: LayoutDashboard, label: "Tổng quan", path: "/dashboard" },
  { icon: Wallet, label: "Ví", path: "/wallets" },
  { icon: History, label: "Giao dịch", path: "/transactions" },
  { icon: HandCoins, label: "Quản lý nợ", path: "/debts" },
  { icon: PiggyBank, label: "Ngân sách", path: "/budgets" },
  { icon: Coins, label: "Khoản tiết kiệm", path: "/savings" },
  { icon: ArrowLeftRight, label: "Giao dịch nội bộ", path: "/transfers" },
];

export default function Layout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const location = useLocation();

  // Lấy tên trang hiện tại
  const currentPage = menuItems.find(m => m.path === location.pathname)?.label || "Trang chủ";

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">

      {/* ── SIDEBAR ── */}
      <aside className="w-60 bg-white border-r border-slate-100 flex flex-col">

        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-200">
              <svg width="16" height="16" viewBox="0 0 40 40" fill="none">
                <path d="M20 2L5 8.5v10.5C5 29.2 11.8 37 20 39 28.2 37 35 29.2 35 19V8.5L20 2z"
                  fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
                <polyline points="10,25 15,18 20,22 26,13 32,8"
                  stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="27,8 32,8 32,13"
                  stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-800">FinTra</span>
              <span className="block text-[9px] font-semibold tracking-widest uppercase text-slate-400 -mt-0.5">Financial</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 px-3 mb-3">Menu</p>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
              >
                <item.icon size={17} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight size={14} className="opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t border-slate-100">
          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl bg-slate-50">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
              <User size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate leading-none">
                {user?.username || "Thành viên"}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              navigate("/auth");
            }}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
          {/* Breadcrumb */}
          <div>
            <h1 className="text-base font-bold text-slate-800">{currentPage}</h1>
            <p className="text-xs text-slate-400">
              {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Notification */}
            <button className="relative h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white" />
            </button>

            {/* Avatar */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-100">
              <div className="h-9 w-9 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-md shadow-blue-200">
                <User size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-none">
                  {user?.username || "Thành viên"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}