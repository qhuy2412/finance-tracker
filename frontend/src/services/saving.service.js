import api from "./api";

export const getSavings = async () => {
  const response = await api.get("/savings");
  return response.data;
};

export const createSaving = async (savingData) => {
  const response = await api.post("/savings", savingData);
  return response.data;
};

// Nạp tiền vào mục tiêu — cần { add_amount, wallet_id, note? }
export const depositToSaving = async (id, payload) => {
  const response = await api.post(`/savings/${id}/deposit`, payload);
  return response.data;
};

// Rút tiền khỏi mục tiêu — cần { withdraw_amount, wallet_id, note? }
export const withdrawFromSaving = async (id, payload) => {
  const response = await api.post(`/savings/${id}/withdraw`, payload);
  return response.data;
};

// Lịch sử nạp/rút của 1 mục tiêu
export const getSavingHistory = async (id) => {
  const response = await api.get(`/savings/${id}/history`);
  return response.data;
};

export const deleteSaving = async (id) => {
  const response = await api.delete(`/savings/${id}`);
  return response.data;
};

// Giải ngân: hoàn trả toàn bộ tiền về đúng ví đã đóng góp (tự động theo net contribution)
export const disburseSaving = async (id) => {
  const response = await api.post(`/savings/${id}/disburse`);
  return response.data;
};

// { walletId: reservedAmount } — số tiền đang "khóa" trong savings theo từng ví
export const getReservedAmounts = async () => {
  const response = await api.get("/savings/reserved");
  return response.data;
};
