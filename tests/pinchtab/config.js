require('dotenv').config({ path: '../../backend/.env' });

module.exports = {
  PINCHTAB_URL: 'http://127.0.0.1:9867',
  APP_URL: 'http://localhost:5173',
  API_URL: 'http://localhost:9999/api',
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  TEST_USER: {
    email: process.env.TEST_EMAIL,
    password: process.env.TEST_PASSWORD
  },
  GOOGLE_SHEETS: {
    SPREADSHEET_ID: '1vUpp5Ebrxtq3hQG5A1nBYRZ2J7Z6OJV5VXF98kF4i4o',
    RANGE: 'Sheet1!A:G'
  },
  DB: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER ,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  }
};
