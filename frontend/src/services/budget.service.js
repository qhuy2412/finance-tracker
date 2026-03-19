import api from "./api";

export const getBudgetStatus = async (month, year) => {
  const response = await api.get("/budgets", {
    params: { month, year }
  });
  return response.data;
};

export const setBudget = async (budgetData) => {
  const response = await api.post("/budgets", budgetData);
  return response.data;
};
