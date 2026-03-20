import { useState, useEffect } from "react";
import { Plus, Loader2, X, ArrowRightLeft, Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWallets } from "../../services/wallet.service";
import { getTransfers, createTransfer } from "../../services/transfer.service";
import { toast } from "react-toastify";

const fmtDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtAmt = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";

export default function Transfers() {
  const [wallets, setWallets] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    from_wallet_id: "",
    to_wallet_id: "",
    amount: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    note: ""
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [walletData, transferData] = await Promise.all([
        getWallets(),
        getTransfers()
      ]);
      setWallets(walletData || []);
      
      const sortedTransfers = (transferData || []).sort(
        (a, b) => new Date(b.transfer_date) - new Date(a.transfer_date)
      );
      setTransfers(sortedTransfers);
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setFormData({
      from_wallet_id: "",
      to_wallet_id: "",
      amount: "",
      transaction_date: new Date().toISOString().slice(0, 10),
      note: ""
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.from_wallet_id || !formData.to_wallet_id) {
      toast.error("Vui lòng chọn đầy đủ ví chuyển và ví nhận!");
      return;
    }
    if (formData.from_wallet_id === formData.to_wallet_id) {
      toast.error("Hai ví không được trùng nhau!");
      return;
    }
    if (Number(formData.amount) <= 0) {
      toast.error("Số tiền phải lớn hơn 0!");
      return;
    }

    const fromWalletInfo = wallets.find(w => w.id.toString() === formData.from_wallet_id);
    if (!fromWalletInfo) {
      toast.error("Không tìm thấy ví nguồn!");
      return;
    }
    if (Number(fromWalletInfo.balance) < Number(formData.amount)) {
      toast.error("Ví nguồn không đủ số dư!");
      return;
    }

    try {
      setIsSubmitting(true);
      await createTransfer({
        from_wallet_id: formData.from_wallet_id,
        to_wallet_id: formData.to_wallet_id,
        amount: Number(formData.amount),
        transaction_date: formData.transaction_date,
        note: formData.note
      });
      await fetchInitialData(); // Refresh list & wallets
      closeModal();
      toast.success("Tạo giao dịch chuyển tiền thành công!");
    } catch (error) {
      console.error("Failed to create transfer:", error);
      toast.error(error.response?.data?.error || "Lỗi tạo giao dịch chuyển tiền!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTransfers = transfers.filter(t => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fromName = (t.from_wallet_name || "").toLowerCase();
    const toName = (t.to_wallet_name || "").toLowerCase();
    return fromName.includes(query) || toName.includes(query);
  });

  const totalTransfers = filteredTransfers.length;
  const totalAmount = filteredTransfers.reduce((acc, t) => acc + Number(t.amount), 0);

  if (loading && wallets.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Chuyển Tiền Nội Bộ</h2>
        <Button onClick={openModal} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" />
          Chuyển tiền mới
        </Button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            type="text" 
            placeholder="Tìm kiếm theo tên ví gửi, ví nhận..."
            className="pl-10 rounded-xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng số GD</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{totalTransfers} Lượt</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng lượng tiền trôi</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{fmtAmt(totalAmount)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-sm relative">
        {filteredTransfers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p>Không tìm thấy lịch sử chuyển tiền nào.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTransfers.map((t) => (
              <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-slate-50 transition-colors gap-4">
                <div className="flex items-center gap-5">
                  <div className="flex flex-col items-center">
                    <p className="text-xs font-medium text-slate-400 mb-1">{fmtDate(t.transfer_date)}</p>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-blue-50 text-blue-500 relative">
                       <ArrowRightLeft size={20} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-700">{t.from_wallet_name}</span>
                      <ArrowRightLeft size={14} className="text-slate-400" />
                      <span className="font-bold text-blue-600">{t.to_wallet_name}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Chuyển tiền nội bộ giữa các ví.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-4 text-right w-full sm:w-auto">
                  <p className="font-black text-lg text-slate-700">
                    {fmtAmt(t.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Tạo chuyển tiền</h3>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from_wallet_id">Từ ví</Label>
                  <select 
                    id="from_wallet_id"
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.from_wallet_id}
                    onChange={(e) => setFormData({...formData, from_wallet_id: e.target.value})}
                    required
                  >
                    <option value="" disabled>-- Chọn ví gửi --</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({fmtAmt(w.balance)})</option>)}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="to_wallet_id">Tới ví</Label>
                  <select 
                    id="to_wallet_id"
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.to_wallet_id}
                    onChange={(e) => setFormData({...formData, to_wallet_id: e.target.value})}
                    required
                  >
                    <option value="" disabled>-- Chọn ví nhận --</option>
                    {wallets.filter(w => w.id.toString() !== formData.from_wallet_id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amount">Số tiền (₫)</Label>
                <Input 
                  id="amount" 
                  type="number"
                  min="1"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transaction_date">Ngày chuyển</Label>
                <Input 
                  id="transaction_date" 
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({...formData, transaction_date: e.target.value})}
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="note">Ghi chú (Tùy chọn)</Label>
                <Input 
                  id="note" 
                  type="text"
                  placeholder="Tiền ăn, Sinh hoạt..."
                  value={formData.note}
                  onChange={(e) => setFormData({...formData, note: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" onClick={closeModal} className="flex-1">
                  Hủy
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                  Chuyển tiền
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
