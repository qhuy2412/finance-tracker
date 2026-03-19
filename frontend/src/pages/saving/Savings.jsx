import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, X, Target, PiggyBank, PlusCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSavings, createSaving, updateSavingProgress, deleteSaving } from "../../services/saving.service";

const fmtDate = (dateString) => {
  if (!dateString) return "Không có hạn";
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtAmt = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";

export default function Savings() {
  const [savings, setSavings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals Data
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeGoal, setActiveGoal] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    current_amount: 0,
    deadline: ""
  });
  
  const [addFundsAmount, setAddFundsAmount] = useState("");

  useEffect(() => {
    fetchSavings();
  }, []);

  const fetchSavings = async () => {
    try {
      setLoading(true);
      const data = await getSavings();
      setSavings(data || []);
    } catch (error) {
      console.error("Failed to fetch savings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Bạn có chắc chắn muốn xóa mục tiêu tiết kiệm này?")) return;
    try {
      await deleteSaving(id);
      await fetchSavings();
    } catch (error) {
      console.error("Failed to delete saving goal:", error);
      alert(error.response?.data?.message || "Không thể xóa mục tiêu này!");
    }
  };

  // Open / Close Create Goal Modal
  const openCreateModal = () => {
    setFormData({
      name: "",
      target_amount: "",
      current_amount: 0,
      deadline: ""
    });
    setIsCreateModalOpen(true);
  };
  const closeCreateModal = () => setIsCreateModalOpen(false);

  // Open / Close Add Funds Modal
  const openAddFundsModal = (goal) => {
    setActiveGoal(goal);
    setAddFundsAmount("");
    setIsAddFundsModalOpen(true);
  };
  const closeAddFundsModal = () => {
    setActiveGoal(null);
    setIsAddFundsModalOpen(false);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.target_amount) return alert("Vui lòng điền đủ tên và mục tiêu!");

    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name,
        target_amount: Number(formData.target_amount),
        current_amount: Number(formData.current_amount || 0),
        deadline: formData.deadline || null
      };

      await createSaving(payload);
      await fetchSavings();
      closeCreateModal();
    } catch (error) {
      console.error("Failed to create saving goal:", error);
      alert(error.response?.data?.message || "Lỗi tạo mục tiêu tiết kiệm!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFundsSubmit = async (e) => {
    e.preventDefault();
    if (!addFundsAmount) return alert("Vui lòng nhập số tiền!");

    try {
      setIsSubmitting(true);
      await updateSavingProgress(activeGoal.id, { add_amount: Number(addFundsAmount) });
      await fetchSavings();
      closeAddFundsModal();
    } catch (error) {
      console.error("Failed to add funds:", error);
      alert(error.response?.data?.error || "Lỗi thêm tiền vào mục tiêu!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSaved = savings.reduce((acc, curr) => acc + Number(curr.current_amount), 0);
  const totalTarget = savings.reduce((acc, curr) => acc + Number(curr.target_amount), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header Summary Cards */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-800">Mục tiêu tiết kiệm</h2>
        <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 shadow-md">
          <Plus size={16} className="mr-2" />
          Tạo mục tiêu
        </Button>
      </div>

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
            const isCompleted = goal.status === 'COMPLETED';
            const current = Number(goal.current_amount);
            const target = Number(goal.target_amount);
            const progress = target > 0 ? (current / target) * 100 : 0;
            const cappedProgress = Math.min(progress, 100);

            return (
              <div key={goal.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col group relative">
                
                {/* Header */}
                <div className="p-5 pb-4 flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">{goal.name}</h3>
                      {isCompleted && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      Hạn: <span className={goal.deadline && new Date(goal.deadline) < new Date() && !isCompleted ? "text-red-500 font-bold" : ""}>{fmtDate(goal.deadline)}</span>
                    </p>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    title="Xóa mục tiêu"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Body Content */}
                <div className="px-5 pb-5 flex-1 flex flex-col justify-end">
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-2xl font-black tracking-tight text-slate-800">{fmtAmt(current)}</p>
                      <p className="text-xs font-medium text-slate-400 mt-0.5">Cần {fmtAmt(target - current > 0 ? target - current : 0)} nữa</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 mb-2">
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className={isCompleted ? "text-green-600" : "text-blue-600"}>{cappedProgress.toFixed(1)}%</span>
                      <span className="text-slate-400">{fmtAmt(target)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${cappedProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                {!isCompleted && (
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100">
                    <button 
                      onClick={() => openAddFundsModal(goal)}
                      className="flex items-center justify-center w-full gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 py-1.5 transition-colors"
                    >
                      <PlusCircle size={16} /> Nạp thêm tiền
                    </button>
                  </div>
                )}
                {isCompleted && (
                   <div className="px-5 py-3 bg-green-50/50 border-t border-green-100">
                    <p className="text-center text-sm font-bold text-green-600">Đã hoàn thành mục tiêu! 🎉</p>
                 </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={closeCreateModal} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg">Tạo mục tiêu tiết kiệm</h3>
              <button type="button" onClick={closeCreateModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-600 font-semibold">Tên mục tiêu / Kế hoạch</Label>
                <Input
                  id="name"
                  autoFocus
                  placeholder="VD: Mua xe máy, Đi du lịch Nhật..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-11 rounded-xl bg-slate-50/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_amount" className="text-slate-600 font-semibold">Số tiền mục tiêu (₫)</Label>
                <Input
                  id="target_amount"
                  type="number"
                  min="0"
                  placeholder="50,000,000"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  className="h-11 rounded-xl bg-slate-50/50 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="current_amount" className="text-slate-600 font-semibold">Đã có (₫)</Label>
                  <Input
                    id="current_amount"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.current_amount}
                    onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                    className="h-11 rounded-xl bg-slate-50/50"
                  />
                  <p className="text-[10px] text-slate-400">Có thể để trống</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline" className="text-slate-600 font-semibold">Ngày hoàn thành</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="h-11 rounded-xl bg-slate-50/50"
                  />
                  <p className="text-[10px] text-slate-400">Không bắt buộc</p>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-base shadow-md">
                  {isSubmitting ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : null}
                  Tạo mục tiêu
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Funds Modal */}
      {isAddFundsModalOpen && activeGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={closeAddFundsModal} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center justify-center px-6 pt-8 pb-6 border-b border-slate-100 bg-slate-50/50">
               <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4 shadow-inner">
                  <PlusCircle size={32} />
               </div>
               <h3 className="font-bold text-slate-800 text-xl text-center leading-tight mb-1">Nạp tiền vào mục tiêu</h3>
               <p className="text-sm font-medium text-slate-500 text-center">{activeGoal.name}</p>
            </div>

            <form onSubmit={handleAddFundsSubmit} className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="addFundsAmount" className="text-slate-600 font-semibold text-center block w-full mb-3">Số tiền muốn nạp (₫)</Label>
                <Input
                  id="addFundsAmount"
                  type="number"
                  min="1"
                  autoFocus
                  placeholder="VD: 5,000,000"
                  value={addFundsAmount}
                  onChange={(e) => setAddFundsAmount(e.target.value)}
                  className="h-14 rounded-2xl bg-white text-center font-bold text-2xl tracking-tight border-2 focus-visible:ring-0 focus-visible:border-blue-500"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <Button type="button" variant="outline" onClick={closeAddFundsModal} className="flex-1 h-12 rounded-xl font-semibold border-slate-200 hover:bg-slate-50">
                  Hủy
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold shadow-md">
                  {isSubmitting ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : null}
                  Xác nhận
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
