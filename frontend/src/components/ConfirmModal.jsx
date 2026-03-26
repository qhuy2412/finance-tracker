import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Modal xác nhận hành động nguy hiểm (thay thế browser confirm()).
 *
 * Props:
 *   isOpen      {boolean}  - Hiển thị modal hay không
 *   onClose     {function} - Gọi khi bấm Hủy hoặc click backdrop
 *   onConfirm   {function} - Gọi khi bấm Xác nhận
 *   title       {string}   - Tiêu đề modal  (mặc định: "Xác nhận")
 *   message     {string}   - Nội dung hỏi  (mặc định: "Bạn có chắc chắn không?")
 *   confirmText {string}   - Nhãn nút xác nhận (mặc định: "Xóa")
 *   isLoading   {boolean}  - Disable nút khi đang xử lý
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Xác nhận",
  message = "Bạn có chắc chắn không? Hành động này không thể hoàn tác.",
  confirmText = "Xóa",
  isLoading = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={18} />
            <h3 className="font-semibold text-slate-800">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
