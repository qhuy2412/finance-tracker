const TestAgent = require('./agent');

async function runDashboardTests() {
  const agent = new TestAgent();
  await agent.run({
    id: "TC-DASH-EXPLORE",
    module: "Dashboard",
    maxSteps: 25,
    goal: `Truy cập '/dashboard'. Thực hiện Exploratory Testing.
    Bạn hãy tự click vào các bộ lọc, quan sát các biểu đồ và tự đánh giá UI/UX. Dùng 'log_finding' để ghi nhận các điểm tốt (PASS) hoặc các lỗi vỡ khung/không có dữ liệu (FAIL).
    Khi nào xem hết các biểu đồ thì gọi 'done'.`
  });
}

module.exports = runDashboardTests;
