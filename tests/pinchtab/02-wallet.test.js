const TestAgent = require('./agent');

async function runWalletTests() {
  const agent = new TestAgent();
  await agent.run({
    id: "TC-WALLET-EXPLORE",
    module: "Wallet",
    maxSteps: 30,
    goal: `Truy cập '/wallets'. Bạn là một QA Tester chuyên nghiệp đang thực hiện Exploratory Testing. 
    Hãy tự nhìn giao diện, tự nhận diện các chức năng (thêm, sửa, xóa, xem danh sách) và tự nghĩ ra các kịch bản để phá ứng dụng (như bỏ trống, nhập sai định dạng, số âm). 
    Mỗi khi thử xong 1 ý tưởng trong đầu, hãy dùng 'log_finding' để ghi lại kết quả (PASS nếu web chặn lỗi tốt, FAIL nếu web bị vỡ hoặc cho lưu dữ liệu bậy).
    Khi cảm thấy đã test hết các ngóc ngách của trang này, hãy gọi 'done'.`
  });
}

module.exports = runWalletTests;
