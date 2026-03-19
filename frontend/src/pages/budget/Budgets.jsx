import { useState, useEffect } from "react";
import { Plus, Loader2, X, ChevronLeft, ChevronRight, TrendingDown, Target, PiggyBank } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBudgetStatus, setBudget } from "../../services/budget.service";
import { getCategories } from "../../services/category.service";

const fmtAmt = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";

// Helper to convert lowercase-kebab to PascalCase and render icon
const CategoryIcon = ({ iconName, ...props }) => {
  if (!iconName) return <span className="text-lg">🏷️</span>;
  const pascalName = iconName.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  const IconCmp = LucideIcons[pascalName];
  if (IconCmp) return <IconCmp {...props} />;
  return <span className="text-lg">🏷️</span>;
};

export default function Budgets() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    category_id: "",
    amount: ""
  });

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  useEffect(() => {
    fetchInitialData();
  }, [month, year]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [cats, budgetData] = await Promise.all([
        getCategories(),
        getBudgetStatus(month, year)
      ]);
      setCategories(cats || []);
      setBudgets(budgetData || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (existingBudget = null) => {
    if (existingBudget) {
      // Find the category id corresponding to existingBudget
      const cat = categories.find(c => c.name === existingBudget.category_name);
      setFormData({
        category_id: cat ? cat.id.toString() : "",
        amount: Number(existingBudget.budget_limit).toString()
      });
    } else {
      setFormData({
        category_id: "",
        amount: ""
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category_id || !formData.amount) {
      return alert("Vui lòng điền đủ thông tin!");
    }

    try {
      setIsSubmitting(true);
      const payload = {
        category_id: formData.category_id,
        amount: Number(formData.amount),
        month,
        year
      };
      await setBudget(payload);
      await fetchInitialData();
      closeModal();
    } catch (error) {
      console.error("Failed to save budget:", error);
      alert(error.response?.data?.message || "Lỗi lưu ngân sách!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const newD = new Date(prev);
      newD.setMonth(newD.getMonth() - 1);
      return newD;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const newD = new Date(prev);
      newD.setMonth(newD.getMonth() + 1);
      return newD;
    });
  };

  // Calculations
  const totalBudget = budgets.reduce((acc, curr) => acc + Number(curr.budget_limit), 0);
  const totalSpent = budgets.reduce((acc, curr) => acc + Number(curr.spent_amount), 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  
  // Exclude categories that already have a budget in the current month to prevent duplicate issues in the dropdown if we only want 1 per category.
  // Actually, UI can allow editing by just re-selecting. But existingBudget flow takes care of it.
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <h2 className="text-2xl font-bold text-slate-800">Ngân sách</h2>
        
        <div className="flex items-center gap-4 bg-white px-2 py-1.5 rounded-xl border border-slate-200 shadow-sm">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8 text-slate-500 hover:text-slate-800">
            <ChevronLeft size={18} />
          </Button>
          <div className="w-32 text-center font-semibold text-slate-700 text-sm">
            Tháng {month}, {year}
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8 text-slate-500 hover:text-slate-800">
            <ChevronRight size={18} />
          </Button>
        </div>

        <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" />
          Thiết lập ngân sách
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Target size={18} className="text-blue-500" />
                <p className="text-xs font-medium uppercase tracking-wider">Tổng ngân sách</p>
              </div>
              <p className="text-xl font-bold text-slate-800">{fmtAmt(totalBudget)}</p>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <TrendingDown size={18} className="text-orange-500" />
                <p className="text-xs font-medium uppercase tracking-wider">Đã chi tiêu</p>
              </div>
              <p className="text-xl font-bold text-slate-800">{fmtAmt(totalSpent)}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <PiggyBank size={18} className="text-green-500" />
                <p className="text-xs font-medium uppercase tracking-wider">Còn lại</p>
              </div>
              <p className={`text-xl font-bold ${totalRemaining < 0 ? 'text-red-500' : 'text-slate-800'}`}>
                {fmtAmt(totalRemaining)}
              </p>
            </div>
          </div>

          {/* Overall Progress */}
          {totalBudget > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-semibold text-slate-700">Mức tiêu thụ tổng</span>
                <span className="text-sm font-bold text-slate-800">{Math.min(overallProgress, 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${overallProgress > 90 ? 'bg-red-500' : overallProgress > 75 ? 'bg-orange-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(overallProgress, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Budgets List */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">Chi tiết ngân sách</h3>
            </div>
            
            {budgets.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Chưa có ngân sách nào được thiết lập cho tháng này.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {budgets.map((budget) => {
                  const spent = Number(budget.spent_amount);
                  const limit = Number(budget.budget_limit);
                  const remaining = Number(budget.remaining_amount);
                  const progress = limit > 0 ? (spent / limit) * 100 : 0;
                  const isOver = spent > limit;

                  return (
                    <div 
                      key={budget.budget_id} 
                      className="p-5 hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => openModal(budget)}
                      title="Nhấn để chỉnh sửa ngân sách"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                            <CategoryIcon iconName={budget.category_icon} size={20} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-800">{budget.category_name}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {isOver ? 'Vượt ngân sách' : `Còn lại ${fmtAmt(remaining)}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">{fmtAmt(spent)}</p>
                          <p className="text-xs text-slate-500 mt-0.5">/ {fmtAmt(limit)}</p>
                        </div>
                      </div>

                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : progress > 80 ? 'bg-orange-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                Thiết lập ngân sách tháng {month}/{year}
              </h3>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="category_id">Danh mục</Label>
                <select
                  id="category_id"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  required
                >
                  <option value="" disabled>-- Chọn danh mục --</option>
                  {categories.filter(c => c.type === 'EXPENSE').map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">Chỉ hiển thị các danh mục chi tiêu.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amount">Số tiền ngân sách (₫)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  placeholder="Ví dụ: 5000000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" onClick={closeModal} className="flex-1">
                  Hủy
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                  Lưu ngân sách
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
