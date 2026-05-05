const TestAgent = require('./agent');

async function runSavingTests() {
  const agent = new TestAgent();
  await agent.run({
    id: "TC-SAVING-EXPLORE",
    module: "Saving",
    maxSteps: 30,
    goal: `Truy cập '/savings'. Bạn là QA Tester thực hiện Exploratory Testing.
    Hãy nhìn vào màn hình, tự đọc hiểu các chức năng (Nạp tiền, Rút tiền, Tạo quỹ) và tự nghĩ ra cách để làm hệ thống bị lỗi.
    Sử dụng 'log_finding' liên tục mỗi khi thử xong 1 trò phá hoại. Gọi 'done' khi hoàn tất.`
  });
}

module.exports = runSavingTests;
