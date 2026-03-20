import { useState, useEffect } from "react";
import { Plus, Wallet as WalletIcon, CreditCard, Banknote, Edit2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWallets, createWallet, updateWallet } from "../../services/wallet.service";
import { toast } from "react-toastify";

const WALLET_TYPES = {
  BANK: { id: "BANK", icon: CreditCard, label: "Ngân hàng", bg: "bg-blue-100 text-blue-600" },
  CASH: { id: "CASH", icon: Banknote, label: "Tiền mặt", bg: "bg-orange-100 text-orange-600" },
  EWALLET: { id: "EWALLET", icon: WalletIcon, label: "Ví điện tử", bg: "bg-purple-100 text-purple-600" },
};

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";

export default function Wallets() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({ name: "", type: "BANK", balance: "" });

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const data = await getWallets();
      setWallets(data || []);
    } catch (error) {
      console.error("Failed to fetch wallets:", error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (wallet = null) => {
    if (wallet) {
      setEditingWallet(wallet);
      setFormData({
        name: wallet.name,
        type: wallet.type || "BANK",
        balance: wallet.balance.toString(),
      });
    } else {
      setEditingWallet(null);
      setFormData({ name: "", type: "BANK", balance: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingWallet(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name,
        type: formData.type,
        balance: Number(formData.balance)
      };

      if (editingWallet) {
        await updateWallet(editingWallet.id, payload);
        toast.success("Cập nhật ví thành công!");
      } else {
        await createWallet(payload);
        toast.success("Thêm ví thành công!");
      }
      
      await fetchWallets();
      closeModal();
    } catch (error) {
      console.error("Failed to save wallet:", error);
      toast.error(error.response?.data?.message || "Lỗi lưu ví!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalBalance = wallets.reduce((acc, curr) => acc + Number(curr.balance), 0);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-500">Tổng số dư</p>
          <h2 className="text-3xl font-bold text-slate-800 mt-1">{fmt(totalBalance)}</h2>
        </div>
        <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" />
          Thêm ví
        </Button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-sm relative">
        {wallets.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Chưa có ví nào được tạo.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {wallets.map((wallet) => {
              const typeConfig = WALLET_TYPES[wallet.type] || WALLET_TYPES.BANK;
              const Icon = typeConfig.icon;
              
              return (
                <div 
                  key={wallet.id} 
                  onClick={() => openModal(wallet)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeConfig.bg}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{wallet.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{typeConfig.label}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-bold text-slate-800">{fmt(wallet.balance)}</p>
                    </div>
                    <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                      <Edit2 size={16} />
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
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                {editingWallet ? "Chỉnh sửa ví" : "Thêm ví mới"}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Tên ví</Label>
                <Input 
                  id="name" 
                  autoFocus
                  placeholder="VD: Ví chính..." 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label>Loại ví</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(WALLET_TYPES).map(type => (
                    <div 
                      key={type.id}
                      onClick={() => setFormData({...formData, type: type.id})}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border text-xs cursor-pointer ${
                        formData.type === type.id 
                          ? "border-blue-600 bg-blue-50 text-blue-700 font-medium" 
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <type.icon size={16} />
                      {type.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="balance">Số dư ban đầu (₫)</Label>
                <Input 
                  id="balance" 
                  type="number"
                  min="0"
                  value={formData.balance}
                  onChange={(e) => setFormData({...formData, balance: e.target.value})}
                  required 
                />
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" onClick={closeModal} className="flex-1">
                  Hủy
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                  Lưu ví
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}