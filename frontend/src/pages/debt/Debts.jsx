import { useState, useEffect } from "react";
import { Plus, HandCoins, Trash2, Loader2, X, ArrowUpRight, ArrowDownRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDebts, createDebt, deleteDebt, payDebt } from "../../services/debt.service";
import { getWallets } from "../../services/wallet.service";

const fmtDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtAmt = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [payFormData, setPayFormData] = useState({
    wallet_id: "",
    pay_amount: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    note: ""
  });

  const [formData, setFormData] = useState({
    wallet_id: "",
    type: "", // "BORROW" or "LEND"
    person_name: "",
    amount: "",
    due_date: new Date().toISOString().slice(0, 10),
    transaction_date: new Date().toISOString().slice(0, 10),
    note: ""
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [walletData, debtData] = await Promise.all([
        getWallets(),
        getDebts()
      ]);
      setWallets(walletData || []);

      const sorted = (debtData || []).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      setDebts(sorted);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDebts = async () => {
    try {
      const data = await getDebts();
      const sorted = (data || []).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      setDebts(sorted);
    } catch (error) {
      console.error("Failed to fetch debts:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Bạn có chắc chắn muốn xóa khoản nợ này?")) return;
    try {
      await deleteDebt(id);
      await fetchInitialData();
    } catch (error) {
      console.error("Failed to delete debt:", error);
      alert(error.response?.data?.message || "Không thể xóa khoản nợ này!");
    }
  };

  const openModal = () => {
    setFormData({
      wallet_id: wallets.length > 0 ? wallets[0].id.toString() : "",
      type: "BORROW",
      person_name: "",
      amount: "",
      due_date: new Date().toISOString().slice(0, 10),
      transaction_date: new Date().toISOString().slice(0, 10),
      note: ""
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.wallet_id) return alert("Vui lòng chọn ví!");

    try {
      setIsSubmitting(true);

      const payload = {
        wallet_id: formData.wallet_id,
        person_name: formData.person_name,
        type: formData.type,
        amount: Number(formData.amount),
        due_date: formData.due_date,
        transaction_date: formData.transaction_date,
        note: formData.note
      };

      await createDebt(payload);
      await fetchInitialData(); // update balance on wallets as well
      closeModal();
    } catch (error) {
      console.error("Failed to save debt:", error);
      alert(error.response?.data?.message || "Lỗi lưu khoản nợ!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPayModal = (debt) => {
    setSelectedDebtId(debt.id);
    setPayFormData({
      wallet_id: wallets.length > 0 ? wallets[0].id.toString() : "",
      pay_amount: "",
      transaction_date: new Date().toISOString().slice(0, 10),
      note: ""
    });
    setIsPayModalOpen(true);
  };

  const closePayModal = () => {
    setIsPayModalOpen(false);
    setSelectedDebtId(null);
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payFormData.wallet_id) return alert("Vui lòng chọn ví!");
    try {
      setIsSubmitting(true);
      await payDebt(selectedDebtId, {
        wallet_id: payFormData.wallet_id,
        pay_amount: Number(payFormData.pay_amount),
        transaction_date: payFormData.transaction_date,
        note: payFormData.note
      });
      await fetchInitialData();
      closePayModal();
    } catch (error) {
      console.error("Failed to pay debt:", error);
      alert(error.response?.data?.message || "Lỗi thanh toán khoản nợ!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations natively using backend type
  const totalBorrowed = debts.filter(d => d.type === 'BORROW').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalLent = debts.filter(d => d.type === 'LEND').reduce((acc, curr) => acc + Number(curr.amount), 0);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header Summary Cards */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-800">Quản lý Nợ</h2>
        <Button onClick={openModal} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" />
          Thêm khoản nợ
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <ArrowDownRight size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng đi vay</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{fmtAmt(totalBorrowed)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
            <ArrowUpRight size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng cho vay</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{fmtAmt(totalLent)}</p>
          </div>
        </div>
      </div>

      {/* Debts List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-sm relative">
        {debts.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Chưa có khoản nợ nào được ghi nhận.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {debts.map((debt) => {
              const isPastDue = new Date(debt.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
              const isBorrow = debt.type === 'BORROW';
              const walletSource = wallets.find(w => w.id == debt.wallet_id)?.name || "?";
              const isPaid = debt.status === 'PAID';

              return (
                <div key={debt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPaid ? "bg-slate-100 text-slate-400" : isBorrow ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"}`}>
                      {isPaid ? <CheckCircle2 size={18} /> : isBorrow ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-slate-800 text-base">{debt.person_name}</h3>
                      <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 font-semibold text-[10px] rounded-md uppercase ${isPaid ? "bg-slate-200 text-slate-600" : isBorrow ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {isBorrow ? "Đi vay" : "Cho vay"}
                        </span>
                        <span>Ví: {walletSource}</span>
                        <span className={`font-medium ${!isPaid && isPastDue ? "text-red-500" : "text-slate-500"}`}>
                          Hạn: {fmtDate(debt.due_date)}
                        </span>
                        {debt.note && <span>• {debt.note}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-right w-full sm:w-auto mt-2 sm:mt-0">
                    <div>
                      <p className={`font-bold text-lg ${isPaid ? "text-slate-400 line-through" : isBorrow ? "text-red-500" : "text-green-500"}`}>
                        {fmtAmt(debt.amount)}
                      </p>
                      {parseFloat(debt.paid_amount) > 0 && <p className="text-xs text-slate-500 font-medium">Đã trả: {fmtAmt(debt.paid_amount)}</p>}
                    </div>
                    <div className="flex gap-2">
                      {!isPaid && (
                        <button
                          onClick={() => openPayModal(debt)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Thanh toán nợ"
                        >
                          <HandCoins size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(debt.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Xóa khoản nợ"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pay Modal Form */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={closePayModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Thanh toán nợ / Thu nợ</h3>
              <button type="button" onClick={closePayModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePaySubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-1.5">
                <Label htmlFor="pay_wallet_id">Ví thanh toán / nhận tiền</Label>
                <select id="pay_wallet_id" className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={payFormData.wallet_id} onChange={(e) => setPayFormData({ ...payFormData, wallet_id: e.target.value })} required>
                  <option value="" disabled>-- Chọn ví --</option>
                  {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay_amount">Số tiền thanh toán (₫)</Label>
                <Input id="pay_amount" type="number" min="1" value={payFormData.pay_amount} onChange={(e) => setPayFormData({ ...payFormData, pay_amount: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay_transaction_date">Ngày thanh toán</Label>
                <Input id="pay_transaction_date" type="date" value={payFormData.transaction_date} onChange={(e) => setPayFormData({ ...payFormData, transaction_date: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay_note">Ghi chú thêm</Label>
                <Input id="pay_note" type="text" placeholder="Ghi chú giao dịch..." value={payFormData.note} onChange={(e) => setPayFormData({ ...payFormData, note: e.target.value })} />
              </div>
              <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" onClick={closePayModal} className="flex-1">Hủy</Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                  Xác nhận
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Thêm khoản nợ mới</h3>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">

              <div className="space-y-1.5">
                <Label>Loại nợ</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setFormData({ ...formData, type: "BORROW" })}
                    className={`text-center p-2 rounded-lg border text-sm cursor-pointer font-medium transition-colors ${formData.type === "BORROW" ? "border-red-500 bg-red-50 text-red-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    Đi vay 
                  </div>
                  <div
                    onClick={() => setFormData({ ...formData, type: "LEND" })}
                    className={`text-center p-2 rounded-lg border text-sm cursor-pointer font-medium transition-colors ${formData.type === "LEND" ? "border-green-500 bg-green-50 text-green-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    Cho vay 
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wallet_id">Giao dịch từ ví / Nhận vào ví</Label>
                <select
                  id="wallet_id"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.wallet_id}
                  onChange={(e) => setFormData({ ...formData, wallet_id: e.target.value })}
                  required
                >
                  <option value="" disabled>-- Chọn ví --</option>
                  {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="person_name">Tên người / Đơn vị giao dịch</Label>
                <Input
                  id="person_name"
                  autoFocus
                  placeholder="VD: Anh Tuấn, Ngân hàng MB..."
                  value={formData.person_name}
                  onChange={(e) => setFormData({ ...formData, person_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amount">Số tiền (₫)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="transaction_date">Ngày giao dịch</Label>
                  <Input
                    id="transaction_date"
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due_date">Ngày đáo hạn</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="note">Ghi chú thêm</Label>
                <Input
                  id="note"
                  type="text"
                  placeholder="Lãi suất 5%, trả góp..."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" onClick={closeModal} className="flex-1">
                  Hủy
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                  Lưu khoản nợ
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
