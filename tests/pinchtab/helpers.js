const axios = require('axios');
const config = require('./config');

const API = config.PINCHTAB_URL;
const PINCHTAB_TOKEN = "6b3293440d60d48a15cb6c8e217547e36e875d66b5ce6646";

const pinchAxios = axios.create({
  baseURL: API,
  headers: {
    'Authorization': `Bearer ${PINCHTAB_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Lấy danh sách tabs
async function getTabs() {
  try {
    const res = await pinchAxios.get(`/tabs`);
    return res.data.tabs || [];
  } catch (error) {
    console.error("Error getting tabs:", error.message);
    return [];
  }
}

// Lấy active tab ID
async function getActiveTabId(allowEmpty = false) {
  const tabs = await getTabs();
  if (tabs.length === 0) {
    if (allowEmpty) return null;
    throw new Error("No active tab found");
  }
  const activeTab = tabs.find(t => t.active) || tabs[0];
  return activeTab.id;
}

// Điều hướng trang web
async function navigate(url, tabId = null) {
  try {
    const targetTab = tabId || await getActiveTabId(true);
    if (!targetTab) {
      await pinchAxios.post(`/navigate`, { url });
    } else {
      await pinchAxios.post(`/tabs/${targetTab}/navigate`, { url });
    }
    await waitFor(2000); 
  } catch (error) {
    console.error(`Error navigating to ${url}:`, error.message);
  }
}

// Lấy accessibility tree snapshot
async function snapshot(tabId = null) {
  try {
    const targetTab = tabId || await getActiveTabId();
    const res = await pinchAxios.get(`/tabs/${targetTab}/snapshot`);
    return res.data;
  } catch (error) {
    console.error("Error getting snapshot:", error.message);
    return null;
  }
}

// Trích xuất text hiển thị
async function getText(tabId = null) {
  try {
    const targetTab = tabId || await getActiveTabId();
    const res = await pinchAxios.get(`/tabs/${targetTab}/text`);
    return res.data.text || (typeof res.data === 'string' ? res.data : JSON.stringify(res.data));
  } catch (error) {
    console.error("Error getting text:", error.message);
    return "";
  }
}

// Gửi hành động click/type
async function action(kind, ref, text = "", waitNav = false, tabId = null) {
  try {
    const targetTab = tabId || await getActiveTabId();
    const payload = { kind, ref, waitNav };
    if (text) payload.text = text;
    
    await pinchAxios.post(`/tabs/${targetTab}/action`, payload);
    await waitFor(500); // Chờ UI phản hồi
  } catch (error) {
    console.error(`Error performing action ${kind} on ${ref}:`, error.message);
  }
}

// Các hàm rút gọn
const click = async (ref, waitNav = false) => action('click', ref, "", waitNav);
const type = async (ref, text) => action('type', ref, text);
const fill = async (ref, text) => action('fill', ref, text);

// Hàm chờ
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Tìm element ref theo text label/name từ snapshot
function findRefByText(snap, text, role = null) {
  if (!snap || !snap.nodes) return null;
  const node = snap.nodes.find(n => 
    n.name && n.name.toLowerCase().includes(text.toLowerCase()) && 
    (!role || n.role === role)
  );
  return node ? node.ref : null;
}

// Ép đăng nhập bằng code cứng (Hardcoded Setup)
async function forceLogin() {
  console.log("🔒 [Setup] Đảm bảo tài khoản đã đăng nhập...");
  await navigate(`${config.APP_URL}/auth`);
  await waitFor(2000);
  
  let snap = await snapshot();
  // Kiểm tra xem có bị chuyển hướng về Dashboard không (Tức là đã có token)
  const isDashboard = findRefByText(snap, 'tổng quan') || findRefByText(snap, 'balance') || findRefByText(snap, 'dashboard') || findRefByText(snap, 'đăng xuất');
  if (isDashboard) {
      console.log("✅ Đã đăng nhập sẵn (Dùng phiên lưu cũ).");
      return;
  }

  console.log("🔑 Đang tiến hành tự động đăng nhập (Hardcoded)...");
  
  // Dựa vào log trước đó, form có ref: email (e4), pass (e8), button (e12)
  // Tuy nhiên ta thử tìm động trước cho chắc
  const emailNode = snap.nodes.find(n => n.role === 'textbox' && (!n.name || n.name.toLowerCase().includes('email')));
  const passNode = snap.nodes.find(n => n.name && (n.name.toLowerCase().includes('mật khẩu') || n.name.toLowerCase().includes('password')));
  const btnNode = findRefByText(snap, 'đăng nhập', 'button') || findRefByText(snap, 'login', 'button');

  const emailRef = emailNode ? emailNode.ref : 'e4';
  const passRef = passNode ? passNode.ref : 'e8';
  const btnRef = btnNode || 'e12';

  await fill(emailRef, config.TEST_USER.email);
  await fill(passRef, config.TEST_USER.password);
  await click(btnRef, true);
  
  await waitFor(3000); // Chờ load xong Dashboard
  console.log("✅ Đăng nhập tự động hoàn tất!");
}

module.exports = {
  navigate,
  snapshot,
  getText,
  click,
  type,
  fill,
  waitFor,
  findRefByText,
  getTabs,
  forceLogin
};
