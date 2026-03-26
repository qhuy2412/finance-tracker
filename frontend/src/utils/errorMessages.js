/**
 * Map lỗi từ server (tiếng Anh) → tiếng Việt để hiển thị cho người dùng.
 * Nếu message không có trong map, fallback về message gốc.
 */
const ERROR_MAP = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  "Username, email, and password are required!": "Vui lòng điền đầy đủ tên, email và mật khẩu!",
  "Email already use!": "Email này đã được sử dụng!",
  "Email and password are required!": "Vui lòng nhập email và mật khẩu!",
  "Email or password is incorrect!": "Email hoặc mật khẩu không đúng!",
  "Unauthorized": "Bạn chưa được xác thực, vui lòng đăng nhập lại!",
  "Unauthorized!": "Bạn chưa được xác thực, vui lòng đăng nhập lại!",
  "Unauthorized! No refresh token found.": "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!",
  "Invalid refresh token!": "Token không hợp lệ, vui lòng đăng nhập lại!",
  "Refresh token not found in database!": "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại!",
  "Refresh token expired!": "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!",
  "User not found!": "Không tìm thấy người dùng!",

  // ── Wallet ─────────────────────────────────────────────────────────────────
  "Name, type, and balance are required!": "Vui lòng điền đầy đủ tên, loại và số dư ví!",
  "Balance must be a positive number!": "Số dư phải là số dương!",
  "Wallet name already exists!": "Tên ví này đã tồn tại!",
  "Wallet not found!": "Không tìm thấy ví!",
  "Wallet not found": "Không tìm thấy ví!",
  "You are not authorized to update this wallet!": "Bạn không có quyền cập nhật ví này!",

  // ── Transaction ────────────────────────────────────────────────────────────
  "Type, amount, transaction_date, categoryId, and walletId are required!":
    "Vui lòng điền đầy đủ loại, số tiền, ngày giao dịch, danh mục và ví!",
  "Type, amount, transaction_date, categoryId are required!":
    "Vui lòng điền đầy đủ loại, số tiền, ngày giao dịch và danh mục!",
  "Amount must be a positive number!": "Số tiền phải là số dương!",
  "Type must be either INCOME or EXPENSE!": "Loại giao dịch phải là Thu nhập hoặc Chi tiêu!",
  "You are not authorized to add transaction to this wallet!":
    "Bạn không có quyền thêm giao dịch vào ví này!",
  "Category not found!": "Không tìm thấy danh mục!",
  "You are not authorized to use this category!": "Bạn không có quyền sử dụng danh mục này!",
  "Not enough balance in wallet!": "Số dư trong ví không đủ!",
  "You are not authorized to delete transaction from this wallet!":
    "Bạn không có quyền xóa giao dịch khỏi ví này!",
  "Transaction not found!": "Không tìm thấy giao dịch!",
  "You are not authorized to update this transaction!":
    "Bạn không có quyền cập nhật giao dịch này!",
  "Not enough balance in wallet for this update!": "Số dư trong ví không đủ để thực hiện cập nhật!",
  "Get all transactions failed!": "Không thể tải danh sách giao dịch!",

  // ── Transfer ───────────────────────────────────────────────────────────────
  "Lack of required field!": "Vui lòng điền đầy đủ thông tin bắt buộc!",
  "Original wallet and destination wallet are the same!":
    "Ví nguồn và ví đích không được trùng nhau!",
  "Transfer amount must be greater than 0!": "Số tiền chuyển phải lớn hơn 0!",

  // ── Debt ───────────────────────────────────────────────────────────────────
  "The type of debt is invalid!": "Loại nợ không hợp lệ (phải là Vay hoặc Cho vay)!",
  "The amount must be greater than 0!": "Số tiền phải lớn hơn 0!",
  "Due date must be greater than transaction date!": "Ngày đáo hạn phải sau ngày giao dịch!",
  "Balance of this wallet is not enough for lend!": "Số dư ví không đủ để cho vay!",
  "wallet_id, pay amount , transaction_date is required!":
    "Vui lòng điền đầy đủ ví, số tiền thanh toán và ngày giao dịch!",
  "Pay amount must be greater than 0!": "Số tiền thanh toán phải lớn hơn 0!",
  "Debt not found or you are unauthorized!": "Không tìm thấy khoản nợ hoặc bạn không có quyền!",
  "Debt is paid!": "Khoản nợ này đã được thanh toán đầy đủ!",
  "You are paying amount greater than this debt": "Số tiền thanh toán vượt quá số nợ còn lại!",
  "Balance of this wallet is not enough for this payment!":
    "Số dư ví không đủ để thực hiện thanh toán!",
  "Cannot delete! This debt has payment transactions. Please delete the payment history first.":
    "Không thể xóa! Khoản nợ này đã có lịch sử thanh toán. Vui lòng xóa lịch sử trước.",

  // ── Saving ─────────────────────────────────────────────────────────────────
  "Name, target_amount are required!": "Vui lòng điền đầy đủ tên và mục tiêu tiết kiệm!",
  "Target amount must be a positive number!": "Mục tiêu tiết kiệm phải là số dương!",
  "Saving goal not found!": "Không tìm thấy mục tiêu tiết kiệm!",
  "You cannot add more than the remaining amount!":
    "Số tiền thêm vào không được vượt quá số tiền còn lại trong mục tiêu!",

  // ── Budget ─────────────────────────────────────────────────────────────────
  // "Lack of required field!" already mapped above

  // ── Generic ───────────────────────────────────────────────────────────────
  "Internal server error": "Lỗi máy chủ nội bộ, vui lòng thử lại sau!",
  "Network Error": "Không thể kết nối đến máy chủ, vui lòng kiểm tra mạng!",
};

/**
 * Dịch một thông báo lỗi tiếng Anh sang tiếng Việt.
 * @param {string | undefined} msg - Message từ server (error.response.data.message)
 * @returns {string} Message tiếng Việt, hoặc message gốc nếu không có trong map.
 */
export function translateError(msg) {
  if (!msg) return "Đã xảy ra lỗi, vui lòng thử lại!";
  return ERROR_MAP[msg] ?? msg;
}
