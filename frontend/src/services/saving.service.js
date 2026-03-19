import api from "./api";

export const getSavings = async () => {
  const response = await api.get("/savings");
  return response.data;
};

export const createSaving = async (savingData) => {
  const response = await api.post("/savings", savingData);
  return response.data;
};

export const updateSavingProgress = async (id, amountData) => {
  const response = await api.put(`/savings/${id}`, amountData);
  return response.data;
};

export const deleteSaving = async (id) => {
  const response = await api.delete(`/savings/${id}`);
  return response.data;
};
