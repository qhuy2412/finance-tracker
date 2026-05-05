const TestAgent = require('./agent');

async function runDebtTests() {
  const agent = new TestAgent();
  await agent.run({
    id: "TC-DEBT-EXPLORE",
    module: "Debt",
    maxSteps: 30,
    goal: `Truy cập '/debts'. Bạn là một QA Tester chuyên nghiệp đang thực hiện Exploratory Testing. 
    Hãy tự nhìn giao diện, tự nhận diện các chức năng và tự nghĩ ra các kịch bản để kiểm thử (cả đường chuẩn Happy Path lẫn các ca kiểm thử dị biệt Edge Cases). 
    Mỗi khi khám phá và thử nghiệm xong 1 chức năng/ý tưởng, hãy dùng 'log_finding' để báo cáo.
    Khi đã test đủ, hãy gọi 'done'.`
  });
}

module.exports = runDebtTests;
