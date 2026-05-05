const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.DB.host,
      user: config.DB.user,
      password: config.DB.password,
      database: config.DB.database,
      port: config.DB.port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

// Chạy query
async function query(sql, params = []) {
  try {
    const connection = await getPool();
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    console.error('DB Query Error:', error.message);
    throw error;
  }
}

// Đóng kết nối
async function close() {
  if (pool) {
    await pool.end();
  }
}

module.exports = {
  query,
  close
};
