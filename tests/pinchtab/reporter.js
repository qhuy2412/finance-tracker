const { google } = require('googleapis');
const config = require('./config');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');

async function getAuth() {
  if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    console.warn(`[WARN] Không tìm thấy file ${SERVICE_ACCOUNT_FILE}. Báo cáo Google Sheets bị vô hiệu hóa.`);
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

const knownSheets = new Set();

/**
 * Đảm bảo sheet (tab) tồn tại, nếu chưa có thì tạo mới và thêm Header
 */
async function ensureSheetExists(sheets, spreadsheetId, sheetName) {
  if (knownSheets.has(sheetName)) return;

  try {
    // Thử lấy thông tin sheet xem có tồn tại không
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = res.data.sheets.some(s => s.properties.title === sheetName);
    
    if (!exists) {
      // Tạo sheet mới
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: { properties: { title: sheetName } }
          }]
        }
      });

      // Thêm header
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1:G1`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [['STT', 'Module', 'Test Case ID', 'Description', 'Result', 'Time', 'Notes']]
        }
      });
      console.log(`[Google Sheets] Đã tạo sheet mới: "${sheetName}"`);
    }
    
    knownSheets.add(sheetName);
  } catch (error) {
    console.error(`[Google Sheets Error]: Không thể tạo/kiểm tra sheet ${sheetName}.`, error.message);
  }
}

/**
 * Ghi 1 dòng báo cáo lên Google Sheets
 * @param {Object} data 
 * @param {number} data.stt Số thứ tự
 * @param {string} data.module Tên module (VD: Auth, Wallet)
 * @param {string} data.tcId ID Test Case (VD: TC-01)
 * @param {string} data.desc Mô tả test
 * @param {string} data.result "✅ PASS" hoặc "❌ FAIL"
 * @param {number} data.time Thời gian chạy (ms)
 * @param {string} data.notes Ghi chú (nếu lỗi)
 */
async function reportResult(data) {
  if (config.GOOGLE_SHEETS.SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
    return; // Bỏ qua nếu chưa cấu hình
  }

  const client = await getAuth();
  if (!client) return;

  const sheets = google.sheets({ version: 'v4', auth: client });
  
  // Đảm bảo tab sheet cho module này tồn tại
  await ensureSheetExists(sheets, config.GOOGLE_SHEETS.SPREADSHEET_ID, data.module);

  const values = [
    [
      data.stt,
      data.module,
      data.tcId,
      data.desc,
      data.result,
      `${data.time} ms`,
      data.notes || ''
    ]
  ];

  try {
    const range = `${data.module}!A:G`;
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.GOOGLE_SHEETS.SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
  } catch (error) {
    console.error('[Google Sheets Error]: Không thể ghi báo cáo.', error.message);
  }
}

module.exports = {
  reportResult
};
