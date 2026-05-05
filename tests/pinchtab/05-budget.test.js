const TestAgent = require('./agent');

async function runBudgetTests() {
  const agent = new TestAgent();
  await agent.run({
    id: "TC-BUDGET-EXPLORE",
    module: "Budget",
    maxSteps: 30,
    goal: `Truy cập '/budgets'. Bạn là QA Tester thực hiện Exploratory Testing.
    Hãy tự do tương tác với màn hình, tự tìm ra nút tạo ngân sách, tự thử nhập sai (số 0, số âm) và dùng 'log_finding' để ghi nhận bất kỳ phát hiện nào của bạn.
    Khám phá cho đến khi không còn ý tưởng nào mới thì gọi 'done'.`
  });
}

module.exports = runBudgetTests;
