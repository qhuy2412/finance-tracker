const axios = require('axios');
const config = require('./config');

const api = axios.create({
  baseURL: config.API_URL,
  withCredentials: true // Để gửi kèm cookie access_token
});

let currentCookie = "";

// Set cookie thủ công (nếu login trả về cookie trong header)
function setCookie(cookieStr) {
  currentCookie = cookieStr;
  api.defaults.headers.Cookie = cookieStr;
}

// Call API Login để lấy cookie (cho API tests)
async function login(email, password) {
  try {
    const res = await api.post('/auth/login', { email, password });
    
    // Lấy cookie từ response headers
    if (res.headers['set-cookie']) {
      const cookies = res.headers['set-cookie'];
      setCookie(cookies.join('; '));
    }
    return res.data;
  } catch (error) {
    throw new Error(`API Login Failed: ${error.response?.data?.message || error.message}`);
  }
}

// Lấy danh sách ví (ví dụ)
async function getWallets() {
  try {
    const res = await api.get('/wallets');
    return res.data;
  } catch (error) {
    throw new Error(`API Get Wallets Failed: ${error.response?.data?.message || error.message}`);
  }
}

module.exports = {
  login,
  getWallets,
  setCookie,
  axios: api // Export axios instance để dùng trực tiếp
};
