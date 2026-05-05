const runAuthTests = require('./01-auth.test.js');
const runWalletTests = require('./02-wallet.test.js');
const runTransactionTests = require('./03-transaction.test.js');
const runDebtTests = require('./04-debt.test.js');
const runBudgetTests = require('./05-budget.test.js');
const runSavingTests = require('./06-saving.test.js');
const runTransferTests = require('./07-transfer.test.js');
const runDashboardTests = require('./08-dashboard.test.js');
const db = require('./db');
const helpers = require('./helpers');

async function runAll() {
  const args = process.argv.slice(2);
  const targetModule = args[0] ? args[0].toLowerCase() : 'all';

  console.log("===================================");
  console.log(`   BẮT ĐẦU CHẠY KIỂM THỬ PINCHTAB (${targetModule.toUpperCase()})`);
  console.log("===================================\n");

  try {
    // Ép đăng nhập cứng trước khi test các module khác (bỏ qua nếu chỉ test Auth)
    if (targetModule !== 'auth') {
      await helpers.forceLogin();
    }

    if (targetModule === 'all' || targetModule === 'auth') await runAuthTests();
    if (targetModule === 'all' || targetModule === 'wallet') await runWalletTests();
    if (targetModule === 'all' || targetModule === 'transaction') await runTransactionTests();
    if (targetModule === 'all' || targetModule === 'debt') await runDebtTests();
    if (targetModule === 'all' || targetModule === 'budget') await runBudgetTests();
    if (targetModule === 'all' || targetModule === 'saving') await runSavingTests();
    if (targetModule === 'all' || targetModule === 'transfer') await runTransferTests();
    if (targetModule === 'all' || targetModule === 'dashboard') await runDashboardTests();
    
    // Đóng kết nối DB nếu có mở
    await db.close();
    
    console.log("\n===================================");
    console.log("         HOÀN THÀNH KIỂM THỬ");
    console.log("===================================");
    console.log("Kết quả đã được ghi lên Google Sheets (nếu đã cấu hình).");
  } catch (error) {
    console.error("Lỗi chạy kiểm thử:", error);
    await db.close();
    process.exit(1);
  }
}

runAll();
