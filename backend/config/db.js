require("dotenv").config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    ssl: process.env.DB_SSL === 'true' ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
    } : null,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

pool.getConnection()
    .then(connection => {
        console.log('Database connected successfully!');
        connection.release();
    })
    .catch(error => {
        console.error('Error connecting to the database:', error);
    });

module.exports = pool;