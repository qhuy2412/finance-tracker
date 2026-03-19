import { useState, useEffect } from "react";
import { getDashboardStats } from "../../services/dashboard.service";
import { Loader2, Wallet, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend
} from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const fmtAmt = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";
const fmtDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const { totalBalance, monthlyIncome, monthlyExpense, chartData, recentTransactions } = stats;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Tổng quan tài chính</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-3xl shadow-lg shadow-blue-200 text-white relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
            <div>
              <p className="text-blue-100 font-medium mb-1">Tổng Số Dư Ví</p>
              <h3 className="text-3xl font-black tracking-tight">{fmtAmt(totalBalance)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-green-50 text-green-600 rounded-2xl">
              <ArrowUpRight className="w-6 h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-500 font-medium mb-1 text-sm">Thu nhập tháng này</p>
            <h3 className="text-2xl font-bold text-slate-800">{fmtAmt(monthlyIncome)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-red-50 text-red-600 rounded-2xl">
              <ArrowDownRight className="w-6 h-6" />
            </div>
          </div>
          <div>
            <p className="text-slate-500 font-medium mb-1 text-sm">Chi tiêu tháng này</p>
            <h3 className="text-2xl font-bold text-slate-800">{fmtAmt(monthlyExpense)}</h3>
          </div>
        </div>
      </div>

      {/* Charts & Recent Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Spending Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Cơ cấu chi tiêu tháng này</h3>

          {chartData?.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) => [fmtAmt(value), 'Số tiền']}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-slate-400">
              <Pie className="w-16 h-16 mb-4 opacity-20" />
              <p>Chưa có khoản chi tiêu nào trong tháng này để hiển thị.</p>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Giao dịch gần đây</h3>

          <div className="flex-1 overflow-hidden shrink-0">
            {recentTransactions?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Activity className="w-12 h-12 mb-3 opacity-20" />
                <p>Bạn chưa có giao dịch nào.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {recentTransactions.map((t) => {
                  const type = t.type || '';
                  const isExpense = type === 'EXPENSE';
                  const isIncome = type === 'INCOME';

                  let colorClasses = "bg-blue-50 text-blue-500";
                  let amountClasses = "text-blue-500";
                  let sign = "";

                  if (isExpense) {
                    colorClasses = "bg-red-50 text-red-500";
                    amountClasses = "text-red-500";
                    sign = "-";
                  } else if (isIncome) {
                    colorClasses = "bg-green-50 text-green-500";
                    amountClasses = "text-green-500";
                    sign = "+";
                  }

                  return (
                    <div key={t.id} className="flex items-center justify-between pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${colorClasses}`}>                           {isExpense ? <ArrowDownRight size={20} /> : isIncome ? <ArrowUpRight size={20} /> : <Activity size={20} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 tracking-tight leading-tight">
                            {t.category_name ? t.category_name : (type === 'TRANSFER' ? 'Chuyển tiền nội bộ' : 'Khác')}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 font-medium">
                            {fmtDate(t.transaction_date)} • {t.wallet_name || '?'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black \${amountClasses}`}>
                          {sign}{fmtAmt(t.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div >
  );
}
