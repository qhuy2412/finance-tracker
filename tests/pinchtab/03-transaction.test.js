const TestAgent = require('./agent');

async function runTransactionTests() {
  const agent = new TestAgent();
  await agent.run({
    id: "TC-TRANS-EXPLORE",
    module: "Transaction",
    maxSteps: 35,
    goal: `Truy cập '/transactions'. Bạn là một QA Tester chuyên nghiệp đang thực hiện Exploratory Testing. 
    Hãy tự nhìn giao diện, tự nhận diện các chức năng và tự nghĩ ra các kịch bản để kiểm thử (cả đường chuẩn Happy Path lẫn các ca kiểm thử dị biệt Edge Cases). 
    Mỗi khi khám phá và thử nghiệm xong 1 chức năng/ý tưởng, hãy dùng 'log_finding' để ghi lại kết quả.
    Khi cảm thấy đã test nát trang này, hãy gọi 'done'.`
  });
}

module.exports = runTransactionTests;
