import { useState, useEffect, useCallback } from "react";
import { getWeeklyReport } from "../../services/report.service";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from "recharts";
import {
  Loader2, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight,
  Minus, AlertTriangle, Bot, TrendingUp, TrendingDown, Calendar,
  BarChart2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAmt = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";

const formatWeekLabel = (weekStart) => {
  if (!weekStart) return "";
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(start.getDate() + 6);
  const fmt = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
  return `${fmt(start)} – ${fmt(end)}/${end.getFullYear()}`;
};

const getPctChange = (current, prev) => {
  if (!prev || prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
};

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ label, amount, icon: Icon, colorClass, bgClass, pctChange }) => (
  <div className={`bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col gap-3`}>
    <div className={`w-10 h-10 ${bgClass} ${colorClass} rounded-2xl flex items-center justify-center`}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
      <p className={`text-2xl font-black ${colorClass}`}>{fmtAmt(amount)}</p>
      {pctChange !== null && pctChange !== undefined && (
        <p className={`text-xs mt-1 font-semibold flex items-center gap-1 ${pctChange > 0 ? "text-red-400" : pctChange < 0 ? "text-green-500" : "text-slate-400"}`}>
          {pctChange > 0 ? <TrendingUp size={12} /> : pctChange < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          {pctChange > 0 ? "+" : ""}{pctChange}% vs tuần trước
        </p>
      )}
    </div>
  </div>
);

const EmptyDay = ({ label }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="w-8 h-1 bg-slate-100 rounded-full" />
    <span className="text-[10px] text-slate-300">{label}</span>
  </div>
);

// ─── Custom bar tooltip ───────────────────────────────────────────────────────

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-lg p-3 text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "income" ? "Thu" : "Chi"}: {fmtAmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function Reports() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async (o) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getWeeklyReport(o);
      setReport(data);
    } catch (err) {
      setError("Không thể tải báo cáo. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(offset);
  }, [offset, fetchReport]);

  const handlePrev = () => setOffset((o) => o + 1);
  const handleNext = () => setOffset((o) => Math.max(0, o - 1));
  const handleReset = () => setOffset(0);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!report || report.empty) {
    return (
      <div className="max-w-5xl mx-auto">
        <WeekNavigator offset={offset} report={report} onPrev={handlePrev} onNext={handleNext} onReset={handleReset} />
        <div className="mt-16 flex flex-col items-center justify-center text-center text-slate-400 gap-4">
          <BarChart2 size={56} className="opacity-10" />
          <p className="text-lg font-semibold">Chưa có báo cáo cho tuần này</p>
          <p className="text-sm">Báo cáo được tạo tự động vào cuối mỗi tuần.</p>
        </div>
      </div>
    );
  }

  // ── Error state — show error INSIDE layout, keep navigator ──────────────
  if (error) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <WeekNavigator offset={offset} report={report} onPrev={handlePrev} onNext={handleNext} onReset={handleReset} />
        <div className="mt-8 flex flex-col items-center text-center text-red-400 gap-4 bg-red-50 border border-red-100 rounded-3xl p-10">
          <AlertTriangle size={36} />
          <p className="font-semibold">{error}</p>
          <button onClick={() => fetchReport(offset)}
            className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const { totals, prevTotals, dailyBreakdown, topCategories, budgetWarnings,
    debtsDueSoon, savingsMilestones, aiSummary, isLive, weekStart } = report;

  const incomePct = getPctChange(totals.income, prevTotals?.income);
  const expensePct = getPctChange(totals.expense, prevTotals?.expense);
  const netPositive = totals.net >= 0;

  // Days completed (for "live" badge)
  const daysWithData = (dailyBreakdown || []).filter(d => d.income > 0 || d.expense > 0).length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* ── Week Navigator ── */}
      <WeekNavigator offset={offset} report={report} onPrev={handlePrev} onNext={handleNext} onReset={handleReset} />

      {/* ── Live badge ── */}
      {isLive && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-2.5 w-fit">
          <Calendar size={15} />
          <span className="font-medium">Tuần đang diễn ra • {daysWithData}/7 ngày có giao dịch</span>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard label="Thu nhập" amount={totals.income} icon={ArrowUpRight}
          colorClass="text-green-600" bgClass="bg-green-50" pctChange={incomePct} />
        <StatCard label="Chi tiêu" amount={totals.expense} icon={ArrowDownRight}
          colorClass="text-red-500" bgClass="bg-red-50" pctChange={expensePct} />
        <div className={`rounded-3xl border shadow-sm p-6 flex flex-col gap-3
          ${netPositive ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-600 shadow-blue-200"
            : "bg-white border-slate-100"}`}>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center
            ${netPositive ? "bg-white/20" : "bg-slate-100"}`}>
            {netPositive
              ? <TrendingUp size={20} className="text-white" />
              : <TrendingDown size={20} className="text-slate-500" />}
          </div>
          <div>
            <p className={`text-xs font-medium mb-0.5 ${netPositive ? "text-blue-100" : "text-slate-400"}`}>
              Còn lại (thu – chi)
            </p>
            <p className={`text-2xl font-black ${netPositive ? "text-white" : "text-slate-700"}`}>
              {netPositive ? "+" : ""}{fmtAmt(totals.net)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Daily Bar Chart ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-800 mb-6">Thu / Chi theo ngày</h3>
        {dailyBreakdown && dailyBreakdown.some(d => d.income > 0 || d.expense > 0) ? (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyBreakdown} barCategoryGap="30%">
                <XAxis dataKey="dayLabel" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <RechartsTooltip content={<BarTooltip />} cursor={{ fill: "#f1f5f9", radius: 8 }} />
                <Bar dataKey="income" name="income" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[220px] flex flex-col items-center justify-center text-slate-300 gap-3">
            <BarChart2 size={40} className="opacity-30" />
            <p className="text-sm">Chưa có giao dịch nào trong tuần này</p>
          </div>
        )}
        {/* Legend */}
        <div className="flex items-center gap-5 mt-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Thu nhập
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Chi tiêu
          </span>
        </div>
      </div>

      {/* ── Categories + Budget Warnings ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pie chart */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Top danh mục chi tiêu</h3>
          {topCategories?.length > 0 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topCategories} dataKey="amount" nameKey="name"
                    cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    paddingAngle={4} stroke="none">
                    {topCategories.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(v, n) => [fmtAmt(v), n]}
                    contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                  />
                  <Legend iconType="circle" iconSize={8}
                    formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-300 text-sm">
              Không có chi tiêu nào
            </div>
          )}
        </div>

        {/* Budget warnings */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Cảnh báo ngân sách</h3>
          {budgetWarnings?.length > 0 ? (
            <div className="space-y-3">
              {budgetWarnings.map((b, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{b.category}</span>
                    <span className={`font-bold ${b.percentage >= 100 ? "text-red-500" : "text-amber-500"}`}>
                      {b.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${b.percentage >= 100 ? "bg-red-500" : "bg-amber-400"}`}
                      style={{ width: `${Math.min(b.percentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {fmtAmt(b.spent)} / {fmtAmt(b.budget)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[150px] flex flex-col items-center justify-center text-slate-300 gap-2 text-sm">
              <span className="text-3xl">✅</span>
              Tất cả ngân sách trong mức kiểm soát
            </div>
          )}
        </div>
      </div>

      {/* ── Debts + Savings ── */}
      {((debtsDueSoon?.length > 0) || (savingsMilestones?.length > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {debtsDueSoon?.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-base font-bold text-slate-800 mb-4">⏰ Nợ sắp đến hạn</h3>
              <div className="space-y-3">
                {debtsDueSoon.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{d.personName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {d.type === "LEND" ? "Cho vay" : "Đi vay"} • Hạn: {new Date(d.dueDate).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <span className={`font-bold text-sm ${d.type === "LEND" ? "text-blue-600" : "text-red-500"}`}>
                      {fmtAmt(d.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {savingsMilestones?.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-base font-bold text-slate-800 mb-4">🎯 Tiết kiệm gần đích</h3>
              <div className="space-y-4">
                {savingsMilestones.map((s, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{s.name}</span>
                      <span className="font-bold text-blue-600">{s.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${Math.min(s.percentage, 100)}%` }} />
                    </div>
                    <p className="text-xs text-slate-400">
                      {fmtAmt(s.currentAmount)} / {fmtAmt(s.targetAmount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AI Summary ── */}
      {aiSummary && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl p-6 flex gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-blue-200">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-blue-800 mb-1">Nhận xét từ AI</p>
            <p className="text-sm text-blue-700 leading-relaxed whitespace-pre-line">{aiSummary}</p>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Week Navigator ───────────────────────────────────────────────────────────

function WeekNavigator({ offset, report, onPrev, onNext, onReset }) {
  const weekLabel = report?.weekStart
    ? formatWeekLabel(report.weekStart)
    : offset === 0 ? "Tuần này" : `${offset} tuần trước`;

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Báo cáo tài chính</h2>
        <p className="text-sm text-slate-400 mt-0.5">{weekLabel}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          id="report-prev-week"
          onClick={onPrev}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          title="Tuần trước"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          id="report-next-week"
          onClick={onNext}
          disabled={offset === 0}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Tuần sau"
        >
          <ChevronRight size={20} />
        </button>
        {offset > 0 && (
          <button
            id="report-back-to-current"
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            Tuần này
          </button>
        )}
      </div>
    </div>
  );
}
