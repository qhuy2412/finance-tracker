require("dotenv").config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    uri : process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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