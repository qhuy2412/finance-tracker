const TestAgent = require('./agent');

async function runTransferTests() {
  const agent = new TestAgent();
  await agent.run({
    id: "TC-TRANSFER-EXPLORE",
    module: "Transfer",
    maxSteps: 30,
    goal: `Truy cập trang Chuyển tiền (Transfers). Thực hiện Exploratory Testing.
    Bạn tự nghĩ ra các kịch bản (chuyển lố tiền, chuyển trùng ví, v.v.), tự thực hiện và ghi nhận bằng 'log_finding'. 
    Gọi 'done' khi đã xong.`
  });
}

module.exports = runTransferTests;
