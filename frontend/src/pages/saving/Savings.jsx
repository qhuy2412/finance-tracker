import { useState, useEffect } from "react";
import {
  Plus, Trash2, Loader2, X, Target, PiggyBank, PlusCircle,
  CheckCircle2, MinusCircle, History, ArrowDownCircle, ArrowUpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSavings, createSaving, depositToSaving, withdrawFromSaving,
  getSavingHistory, deleteSaving, getReservedAmounts
} from "../../services/saving.service";
import { getWallets } from "../../services/wallet.service";
import { toast } from "react-toastify";
import ConfirmModal from "../../components/ConfirmModal";

const fmtDate = (dateString) => {
  if (!dateString) return "Không có hạn";
  return new Date(dateString).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
};

const fmtAmt = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";

const fmtDateTime = (str) => {
  if (!str) return "";
  return new Date(str).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

export default function Savings() {
  const [savings, setSavings] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [reserved, setReserved] = useState({}); // { walletId: reservedAmount }
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeGoal, setActiveGoal] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ open: false, id: null });

  // Form: Tạo mục tiêu
  const [formData, setFormData] = useState({
    name: "", target_amount: "", current_amount: 0, deadline: "",
  });

  // Form: Nạp tiền
  const [depositData, setDepositData] = useState({
    add_amount: "", wallet_id: "", note: "",
  });

  // Form: Rút tiền
  const [withdrawData, setWithdrawData] = useState({
    withdraw_amount: "", wallet_id: "", note: "",
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [savData, wData, resData] = await Promise.all([getSavings(), getWallets(), getReservedAmounts()]);
      setSavings(savData || []);
      setWallets(wData || []);
      setReserved(resData || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete ──────────────────────────────────────
  const handleDelete = (id) => setConfirmModal({ open: true, id });
  const confirmDelete = async () => {
    try {
      await deleteSaving(confirmModal.id);
      await fetchAll();
      toast.success("Xóa mục tiêu thành công!");
    } catch (e) {
      toast.error(e.response?.data?.message || "Lỗi xóa mục tiêu!");
    } finally {
      setConfirmModal({ open: false, id: null });
    }
  };

  // ── Create ───────────────────────────────────────
  const openCreateModal = () => {
    setFormData({
      name: "", target_amount: "", current_amount: 0, deadline: "",
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.target_amount) {
      toast.error("Vui lòng điền đủ tên và số tiền mục tiêu!");
      return;
    }
    try {
      setIsSubmitting(true);
      await createSaving({
        name: formData.name,
        target_amount: Number(formData.target_amount),
        current_amount: Number(formData.current_amount || 0),
        deadline: formData.deadline || null,
      });
      await fetchAll();
      setIsCreateModalOpen(false);
      toast.success("Tạo mục tiêu tiết kiệm thành công!");
    } catch (e) {
      toast.error(e.response?.data?.message || "Lỗi tạo mục tiêu!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Deposit ──────────────────────────────────────
  const openDepositModal = (goal) => {
    setActiveGoal(goal);
    setDepositData({
      add_amount: "",
      wallet_id: wallets.length > 0 ? wallets[0].id : "",
      note: "",
    });
    setIsDepositModalOpen(true);
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    if (!depositData.add_amount || !depositData.wallet_id) {
      toast.error("Vui lòng nhập số tiền và chọn ví!");
      return;
    }
    try {
      setIsSubmitting(true);
      await depositToSaving(activeGoal.id, {
        add_amount: Number(depositData.add_amount),
        wallet_id: depositData.wallet_id,
        note: depositData.note || null,
      });
      await fetchAll();
      setIsDepositModalOpen(false);
      toast.success("Nạp tiền vào mục tiêu thành công!");
    } catch (e) {
      toast.error(e.response?.data?.message || "Lỗi nạp tiền!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Withdraw ─────────────────────────────────────
  const openWithdrawModal = (goal) => {
    setActiveGoal(goal);
    setWithdrawData({
      withdraw_amount: "",
      wallet_id: wallets.length > 0 ? wallets[0].id : "",
      note: "",
    });
    setIsWithdrawModalOpen(true);
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    if (!withdrawData.withdraw_amount || !withdrawData.wallet_id) {
      toast.error("Vui lòng nhập số tiền và chọn ví!");
      return;
    }
    try {
      setIsSubmitting(true);
      await withdrawFromSaving(activeGoal.id, {
        withdraw_amount: Number(withdrawData.withdraw_amount),
        wallet_id: withdrawData.wallet_id,
        note: withdrawData.note || null,
      });
      await fetchAll();
      setIsWithdrawModalOpen(false);
      toast.success("Rút tiền thành công!");
    } catch (e) {
      toast.error(e.response?.data?.message || "Lỗi rút tiền!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── History ───────────────────────────────────────
  const openHistoryModal = async (goal) => {
    setActiveGoal(goal);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const data = await getSavingHistory(goal.id);
      setHistory(data || []);
    } catch (e) {
      toast.error("Không thể tải lịch sử!");
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Computed ─────────────────────────────────────
  const totalSaved = savings.reduce((acc, s) => acc + Number(s.current_amount), 0);
  const totalTarget = savings.reduce((acc, s) => acc + Number(s.target_amount), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const WalletSelect = ({ value, onChange, label = "Ví" }) => (
    <div className="space-y-2">
      <Label className="text-slate-600 font-semibold">{label}</Label>
      <select
        value={value}
        onChange={onChange}
        required
        className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">-- Chọn ví --</option>
        {wallets.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name} ({fmtAmt(w.balance)})
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-800">Mục tiêu tiết kiệm</h2>
        <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 shadow-md">
          <Plus size={16} className="mr-2" /> Tạo mục tiêu
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 relative z-10">
            <PiggyBank size={24} />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-slate-500 mb-0.5">Tổng đã tích lũy</p>
            <p className="text-2xl font-bold text-slate-800">{fmtAmt(totalSaved)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 relative z-10">
            <Target size={24} />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-slate-500 mb-0.5">Tổng mục tiêu</p>
            <p className="text-2xl font-bold text-slate-800">{fmtAmt(totalTarget)}</p>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      {savings.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-end mb-3">
            <span className="text-sm font-semibold text-slate-600">Tiến độ chung</span>
            <span className="text-sm font-bold text-blue-600">{Math.min(overallProgress, 100).toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Savings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {savings.length === 0 ? (
          <div className="col-span-full p-12 bg-white rounded-3xl border border-slate-100 shadow-sm text-center text-slate-500">
            Chưa có mục tiêu tiết kiệm nào. Hãy tạo một mục tiêu để bắt đầu tích lũy!
          </div>
        ) : (
          savings.map((goal) => {
            const isCompleted = goal.status === "COMPLETED";
            const current = Number(goal.current_amount);
            const target = Number(goal.target_amount);
            const progress = target > 0 ? (current / target) * 100 : 0;
            const cappedProgress = Math.min(progress, 100);
            return (
              <div key={goal.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col group relative">

                {/* Header */}
                <div className="p-5 pb-3 flex items-start justify-between">
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">{goal.name}</h3>
                      {isCompleted && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      Hạn:{" "}
                      <span className={goal.deadline && new Date(goal.deadline) < new Date() && !isCompleted ? "text-red-500 font-bold" : ""}>
                        {fmtDate(goal.deadline)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => openHistoryModal(goal)}
                      className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="Lịch sử"
                    >
                      <History size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="Xóa mục tiêu"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 pb-4 flex-1 flex flex-col justify-end">
                  <div className="flex items-end justify-between mb-1">
                    <div>
                      <p className="text-2xl font-black tracking-tight text-slate-800">{fmtAmt(current)}</p>
                      <p className="text-xs font-medium text-slate-400 mt-0.5">
                        {target - current > 0 ? `Cần ${fmtAmt(target - current)} nữa` : "Đã đạt mục tiêu!"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 mb-1">
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className={isCompleted ? "text-green-600" : "text-blue-600"}>{cappedProgress.toFixed(1)}%</span>
                      <span className="text-slate-400">{fmtAmt(target)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${isCompleted ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: `${cappedProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                {!isCompleted ? (
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex gap-2">
                    <button
                      onClick={() => openDepositModal(goal)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-2 rounded-xl transition-colors"
                    >
                      <PlusCircle size={14} /> Nạp tiền
                    </button>
                    {current > 0 && (
                      <button
                        onClick={() => openWithdrawModal(goal)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 hover:bg-orange-50 py-2 rounded-xl transition-colors"
                      >
                        <MinusCircle size={14} /> Rút tiền
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="px-5 py-3 bg-green-50/50 border-t border-green-100">
                    <p className="text-center text-sm font-bold text-green-600">Đã hoàn thành mục tiêu! 🎉</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Modal: Tạo mục tiêu ───────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg">Tạo mục tiêu tiết kiệm</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-600 font-semibold">Tên mục tiêu / Kế hoạch</Label>
                <Input autoFocus placeholder="VD: Mua xe máy, Đi du lịch Nhật..." value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-11 rounded-xl bg-slate-50/50" required />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-semibold">Số tiền mục tiêu (₫)</Label>
                <Input type="number" min="0" placeholder="50,000,000" value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  className="h-11 rounded-xl bg-slate-50/50 font-medium" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-600 font-semibold">Đã có (₫)</Label>
                  <Input type="number" min="0" placeholder="0" value={formData.current_amount}
                    onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                    className="h-11 rounded-xl bg-slate-50/50" />
                  <p className="text-[10px] text-slate-400">Có thể để trống</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-600 font-semibold">Ngày hoàn thành</Label>
                  <Input type="date" value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="h-11 rounded-xl bg-slate-50/50" />
                  <p className="text-[10px] text-slate-400">Không bắt buộc</p>
                </div>
              </div>
              <div className="pt-1">
                <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-base shadow-md">
                  {isSubmitting ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : null}
                  Tạo mục tiêu
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Nạp tiền ───────────────────────────────── */}
      {isDepositModalOpen && activeGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsDepositModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center justify-center px-6 pt-7 pb-5 border-b border-slate-100 bg-blue-50/40">
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                <ArrowDownCircle size={28} />
              </div>
              <h3 className="font-bold text-slate-800 text-xl text-center">Nạp tiền vào mục tiêu</h3>
              <p className="text-sm font-medium text-slate-500 text-center mt-1">{activeGoal.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Còn cần: <span className="font-bold text-blue-600">{fmtAmt(Number(activeGoal.target_amount) - Number(activeGoal.current_amount))}</span>
              </p>
            </div>
            <form onSubmit={handleDepositSubmit} className="p-6 space-y-4">
              {/* Chọn ví trước để tính available */}
              <WalletSelect
                label="Nạp từ ví"
                value={depositData.wallet_id}
                onChange={(e) => setDepositData({ ...depositData, wallet_id: e.target.value, add_amount: "" })}
              />
              {/* Hiển thị số dư khả dụng của ví được chọn */}
              {depositData.wallet_id && (() => {
                const w = wallets.find(w => w.id === depositData.wallet_id);
                if (!w) return null;
                const res = Number(reserved[w.id] || 0);
                const avail = Number(w.balance) - res;
                return (
                  <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl ${
                    avail <= 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'
                  }`}>
                    <span>Khả dụng trong ví:</span>
                    <span className={`font-bold ${avail <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmtAmt(Math.max(avail, 0))}
                      {res > 0 && <span className="font-normal text-slate-400"> ({fmtAmt(w.balance)} - {fmtAmt(res)} tiết kiệm)</span>}
                    </span>
                  </div>
                );
              })()}
              <div className="space-y-2">
                <Label className="text-slate-600 font-semibold text-center block">Số tiền muốn nạp (₫)</Label>
                <Input type="number" min="1"
                  max={(() => {
                    const w = wallets.find(w => w.id === depositData.wallet_id);
                    if (!w) return undefined;
                    const res = Number(reserved[w.id] || 0);
                    return Math.max(0, Number(w.balance) - res);
                  })()}
                  autoFocus placeholder="VD: 5,000,000"
                  value={depositData.add_amount}
                  onChange={(e) => setDepositData({ ...depositData, add_amount: e.target.value })}
                  className="h-14 rounded-2xl bg-white text-center font-bold text-2xl tracking-tight border-2 focus-visible:ring-0 focus-visible:border-blue-500"
                  required />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-semibold">Ghi chú <span className="text-slate-400 font-normal text-xs">(không bắt buộc)</span></Label>
                <Input placeholder="VD: Lương tháng 4..." value={depositData.note}
                  onChange={(e) => setDepositData({ ...depositData, note: e.target.value })}
                  className="h-10 rounded-xl" />
              </div>
              <div className="pt-1 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDepositModalOpen(false)} className="flex-1 h-12 rounded-xl">Hủy</Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold shadow-md">
                  {isSubmitting ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : null} Xác nhận
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Rút tiền ───────────────────────────────── */}
      {isWithdrawModalOpen && activeGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsWithdrawModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center justify-center px-6 pt-7 pb-5 border-b border-orange-100 bg-orange-50/40">
              <div className="w-14 h-14 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center mb-3">
                <ArrowUpCircle size={28} />
              </div>
              <h3 className="font-bold text-slate-800 text-xl text-center">Rút tiền khỏi mục tiêu</h3>
              <p className="text-sm font-medium text-slate-500 text-center mt-1">{activeGoal.name}</p>
              <p className="text-xs text-orange-500 font-medium mt-0.5">⚠️ Rút tiền sẽ làm chậm tiến độ mục tiêu</p>
            </div>
            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-600 font-semibold text-center block">
                  Số tiền muốn rút (₫) — Tối đa {fmtAmt(activeGoal.current_amount)}
                </Label>
                <Input type="number" min="1" max={activeGoal.current_amount} autoFocus
                  placeholder="VD: 1,000,000"
                  value={withdrawData.withdraw_amount}
                  onChange={(e) => setWithdrawData({ ...withdrawData, withdraw_amount: e.target.value })}
                  className="h-14 rounded-2xl bg-white text-center font-bold text-2xl tracking-tight border-2 focus-visible:ring-0 focus-visible:border-orange-400"
                  required />
              </div>
              <WalletSelect
                label="Rút về ví"
                value={withdrawData.wallet_id}
                onChange={(e) => setWithdrawData({ ...withdrawData, wallet_id: e.target.value })}
              />
              <div className="space-y-2">
                <Label className="text-slate-600 font-semibold">Lý do <span className="text-slate-400 font-normal text-xs">(không bắt buộc)</span></Label>
                <Input placeholder="VD: Chi tiêu khẩn cấp..." value={withdrawData.note}
                  onChange={(e) => setWithdrawData({ ...withdrawData, note: e.target.value })}
                  className="h-10 rounded-xl" />
              </div>
              <div className="pt-1 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setIsWithdrawModalOpen(false)} className="flex-1 h-12 rounded-xl">Hủy</Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-md">
                  {isSubmitting ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : null} Rút tiền
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Lịch sử ────────────────────────────────── */}
      {isHistoryModalOpen && activeGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsHistoryModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Lịch sử giao dịch</h3>
                <p className="text-sm text-slate-500 mt-0.5">{activeGoal.name}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {loadingHistory ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400 h-6 w-6" /></div>
              ) : history.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">Chưa có giao dịch nào</div>
              ) : (
                history.map((tx) => (
                  <div key={tx.id} className="px-6 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.type === "DEPOSIT" ? "bg-blue-50 text-blue-500" : "bg-orange-50 text-orange-500"}`}>
                        {tx.type === "DEPOSIT" ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {tx.type === "DEPOSIT" ? "Nạp tiền" : "Rút tiền"}{tx.wallet_name ? ` · ${tx.wallet_name}` : ""}
                        </p>
                        <p className="text-xs text-slate-400">{fmtDateTime(tx.created_at)}{tx.note ? ` · ${tx.note}` : ""}</p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${tx.type === "DEPOSIT" ? "text-blue-600" : "text-orange-500"}`}>
                      {tx.type === "DEPOSIT" ? "+" : "-"}{fmtAmt(tx.amount)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, id: null })}
        onConfirm={confirmDelete}
        title="Xóa mục tiêu tiết kiệm"
        message="Bạn có chắc chắn muốn xóa mục tiêu này? Hành động này không thể hoàn tác."
        confirmText="Xóa"
      />
    </div>
  );
}
