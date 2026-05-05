const TestAgent = require('./agent');
const config = require('./config');
async function runAuthTests() {
  const agent = new TestAgent();

  await agent.run({
    id: "TC-AUTH-EXPLORE",
    module: "Auth",
    maxSteps: 20,
    goal: `Khám phá module Đăng nhập (Auth). Bạn hãy truy cập '/auth'. 
    [CỰC KỲ QUAN TRỌNG]: Nếu web tự động chuyển hướng bạn sang trang Tổng quan (Dashboard) hoặc bạn không thấy form đăng nhập, nghĩa là bạn đang kẹt ở phiên đăng nhập cũ! Bạn PHẢI tìm nút 'Đăng xuất' (Logout) trên màn hình hiện tại và click vào nó để thoát ra ngoài trước khi bắt đầu test.
    Sau khi đã thấy form đăng nhập:
    1. Thử đăng nhập bằng email 'wrong@test.com' và password '123456'. Dùng 'log_finding' ghi kết quả.
    2. Sau đó thử đăng nhập bằng tài khoản đúng: email '${config.TEST_USER.email}' và password '${config.TEST_USER.password}'. Dùng 'log_finding' ghi kết quả xem có vào được Dashboard không.
    Hoàn thành thì gọi 'done'.`
  });
}

module.exports = runAuthTests;
