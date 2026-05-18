/**
 * chatFormatters.js
 * Shared text formatting helpers used by both web chat (chatControllerV3)
 * and Telegram bot (chatService). Single source of truth for message formats.
 */

const formatTransactionConfirmText = (data) => {
    const txs = Array.isArray(data) ? data : [data];
    let text = `Bạn xác nhận thông tin sau:\n`;
    
    txs.forEach((tx, index) => {
        if (txs.length > 1) {
            text += `\n[Giao dịch ${index + 1}]\n`;
        }
        text += `- Loại: ${tx.type === 'EXPENSE' ? 'Chi tiêu' : 'Thu nhập'}\n` +
               `- Số tiền: ${Number(tx.amount).toLocaleString('vi-VN')} đ\n` +
               `- Ví: "${tx.wallet_name}"\n` +
               `- Danh mục: "${tx.category_name}"\n` +
               `- Ngày: ${tx.date}\n` +
               `${tx.note ? `- Ghi chú: ${tx.note}\n` : ''}`;
    });

    text += `\nTrả lời "Đồng ý" để lưu hoặc "Hủy" để bỏ qua.`;
    return text;
};

const formatTransactionErrorVi = (msg) => {
    const m = String(msg || '');
    if (/Wallet not found/i.test(m)) return 'Không tìm thấy ví theo tên đã chọn.';
    if (/Category not found/i.test(m)) return 'Không tìm thấy danh mục theo tên đã chọn.';
    if (/Not enough balance/i.test(m)) return 'Số dư ví không đủ cho khoản chi này.';
    if (/must be either INCOME or EXPENSE/i.test(m)) return 'Loại giao dịch không hợp lệ.';
    if (/Amount must be a positive number/i.test(m)) return 'Số tiền phải là số dương.';
    return 'Không thể tạo giao dịch. Vui lòng thử lại.';
};

module.exports = { formatTransactionConfirmText, formatTransactionErrorVi };
