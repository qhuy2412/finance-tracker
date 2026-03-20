import { useState, useEffect, useMemo } from "react";
import { Plus, ArrowDownCircle, ArrowUpCircle, Trash2, Loader2, X, Wallet as WalletIcon, Search, FilterX, Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWallets } from "../../services/wallet.service";
import { getTransactions, createTransaction, deleteTransaction } from "../../services/transaction.service";
import { getCategories } from "../../services/category.service";

const fmtDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtAmt = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";

export default function Transactions() {
  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [filterWallet, setFilterWallet] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDate, setFilterDate] = useState(""); // YYYY-MM or YYYY-MM-DD
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalWalletId, setModalWalletId] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    type: "EXPENSE",
    amount: "",
    categoryId: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    note: ""
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [walletData, catData] = await Promise.all([
        getWallets(),
        getCategories()
      ]);
      const activeWallets = walletData || [];
      setWallets(activeWallets);
      setCategories(catData || []);

      // Concurrently fetch all transactions for all wallets to create a global list
      if (activeWallets.length > 0) {
        setModalWalletId(activeWallets[0].id.toString());
        await fetchAllTransactions(activeWallets);
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTransactions = async (activeWallets) => {
    try {
      const promises = activeWallets.map(w => getTransactions(w.id));
      const results = await Promise.all(promises);
      let combined = [];
      results.forEach(res => {
        if (Array.isArray(res)) combined = [...combined, ...res];
      });
      // Sort by date descending
      combined.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
      setAllTransactions(combined);
    } catch (error) {
      console.error("Failed to fetch global transactions:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Bạn có chắc chắn muốn xóa giao dịch này?")) return;
    try {
      await deleteTransaction(id);
      await fetchAllTransactions(wallets);
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    }
  };

  const openModal = () => {
    setFormData({
      type: "expense",
      amount: "",
      categoryId: categories.length > 0 ? categories[0].id.toString() : "",
      transaction_date: new Date().toISOString().slice(0, 10),
      note: ""
    });
    // If a specific wallet is currently filtered, default to it
    if (filterWallet !== "all") {
      setModalWalletId(filterWallet);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!modalWalletId) return alert("Vui lòng chọn ví!");
    if (!formData.categoryId) return alert("Vui lòng chọn danh mục!");

    try {
      setIsSubmitting(true);
      console.log("Submitting transaction with data:", { ...formData, walletId: modalWalletId });
      const payload = {
        categoryId: formData.categoryId,
        type: formData.type,
        amount: Number(formData.amount),
        transaction_date: formData.transaction_date,
        note: formData.note
      };

      await createTransaction(modalWalletId, payload);
      await fetchAllTransactions(wallets);
      closeModal();
    } catch (error) {
      console.error("Failed to save transaction:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setFilterWallet("all");
    setFilterCategory("all");
    setFilterDate("");
    setSearchQuery("");
  };

  // Filtered Computed List
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      // 1. Wallet Filter
      if (filterWallet !== "all" && t.wallet_id.toString() !== filterWallet) return false;

      // 2. Category Filter
      if (filterCategory !== "all" && t.category_id?.toString() !== filterCategory) return false;

      // 3. Date Filter (matches YYYY-MM exactly if type="month" is used)
      if (filterDate && !t.transaction_date.startsWith(filterDate)) return false;

      // 4. Search Query (matches note or category name)
      if (searchQuery.trim() !== "") {
        const cat = categories.find(c => c.id == t.category_id);
        const catName = cat ? cat.name.toLowerCase() : "";
        const note = t.note ? t.note.toLowerCase() : "";
        const query = searchQuery.toLowerCase();
        if (!catName.includes(query) && !note.includes(query)) return false;
      }

      return true;
    });
  }, [allTransactions, filterWallet, filterCategory, filterDate, searchQuery, categories]);

  if (loading && wallets.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Calculate totals using ONLY the filtered items
  const totalIncome = filteredTransactions.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Title & Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Tất cả Giao Dịch</h2>
        <Button onClick={openModal} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" />
          Thêm giao dịch
        </Button>
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            type="text"
            placeholder="Tìm kiếm theo ghi chú hoặc danh mục..."
            className="pl-10 rounded-xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Dropdowns & Pickers */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterWallet}
            onChange={(e) => setFilterWallet(e.target.value)}
            className="flex h-10 flex-1 min-w-[140px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">-- Tất cả ví --</option>
            {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="flex h-10 flex-1 min-w-[140px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">-- Tất cả danh mục --</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <Input
            type="month"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="flex-1 min-w-[140px] rounded-xl cursor-text"
          />

          {(filterWallet !== "all" || filterCategory !== "all" || filterDate !== "" || searchQuery !== "") && (
            <Button variant="ghost" onClick={clearFilters} className="text-slate-500 hover:text-red-500 hover:bg-red-50 px-3 shrink-0">
              <FilterX size={16} className="mr-2" /> Xóa bộ lọc
            </Button>
          )}
        </div>
      </div>

      {/* Filtered Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
            <ArrowUpCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng thu</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">+{fmtAmt(totalIncome)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <ArrowDownCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng chi</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">-{fmtAmt(totalExpense)}</p>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-sm relative">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p>Không tìm thấy giao dịch nào phù hợp.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map((t) => {
              const type = t.type || '';
              const isExpense = type === 'EXPENSE';
              const isIncome = type === 'INCOME';

              const cat = categories.find(c => c.id == t.category_id);
              const walletName = wallets.find(w => w.id == t.wallet_id)?.name || "?";

              let colorClasses = "bg-blue-50 text-blue-500";
              let amountClasses = "text-blue-500";
              let sign = "";
              let IconCmp = Activity;

              if (isExpense) {
                colorClasses = "bg-red-50 text-red-500";
                amountClasses = "text-red-500";
                sign = "-";
                IconCmp = ArrowDownCircle;
              } else if (isIncome) {
                colorClasses = "bg-green-50 text-green-500";
                amountClasses = "text-green-500";
                sign = "+";
                IconCmp = ArrowUpCircle;
              } else if (type === 'DEBT_IN') {
                colorClasses = "bg-orange-50 text-orange-500";
                amountClasses = "text-orange-500";
                sign = "+";
                IconCmp = ArrowDownRight;
              } else if (type === 'DEBT_OUT') {
                colorClasses = "bg-purple-50 text-purple-500";
                amountClasses = "text-purple-500";
                sign = "-";
                IconCmp = ArrowUpRight;
              }

              return (
                <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClasses}`}>
                      <IconCmp size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        {cat ? cat.name : (
                          type === 'TRANSFER' ? 'Chuyển khoản' :
                            type === 'DEBT_IN' ? 'Đi vay / Thu nợ' :
                              type === 'DEBT_OUT' ? 'Cho vay / Trả nợ' : 'Khác'
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase mr-2 ${colorClasses}`}>
                          {isExpense ? 'Chi' : isIncome ? 'Thu' : (type === 'DEBT_IN' ? 'VAY' : type === 'DEBT_OUT' ? 'TRẢ/CHO VAY' : type)}
                        </span>
                        {fmtDate(t.transaction_date)} • <span className="font-medium text-slate-600">{walletName}</span>
                        {t.note ? ` • ${t.note}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-right w-full sm:w-auto">
                    <div>
                      <p className={`font-bold ${amountClasses}`}>
                        {sign}{fmtAmt(t.amount)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Xóa giao dịch"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Thêm giao dịch</h3>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              <div className="space-y-1.5">
                <Label htmlFor="modalWalletId">Từ ví</Label>
                <select
                  id="modalWalletId"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={modalWalletId}
                  onChange={(e) => setModalWalletId(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Chọn ví --</option>
                  {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Loại giao dịch</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setFormData({ ...formData, type: "EXPENSE" })}
                    className={`text-center p-2 rounded-lg border text-sm cursor-pointer font-medium transition-colors ${formData.type === "EXPENSE" ? "border-red-500 bg-red-50 text-red-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    Khoản chi
                  </div>
                  <div
                    onClick={() => setFormData({ ...formData, type: "INCOME" })}
                    className={`text-center p-2 rounded-lg border text-sm cursor-pointer font-medium transition-colors ${formData.type === "INCOME" ? "border-green-500 bg-green-50 text-green-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    Khoản thu
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="categoryId">Danh mục</Label>
                <select
                  id="categoryId"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  required
                >
                  <option value="" disabled>-- Chọn danh mục --</option>
                  {categories.map(c => (
                    c.type === formData.type &&
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
                <Label htmlFor="note">Ghi chú</Label>
                <Input
                  id="note"
                  type="text"
                  placeholder="Đi ăn, mua sắm..."
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
                  Lưu
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
