const db = require("../config/db");

const User = {
    findByEmail: async (email) => {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?',[email]);
        return results[0];
    },
    create : async (userId,username, email, password) => {
        return await db.query('INSERT INTO users (id,user_name, email, hash_password) VALUES (?,?, ?, ?)', [userId,username, email, password]);
    },
    findById: async (id) => {
        const [results] = await db.query('SELECT * FROM users WHERE id = ?',[id]);
        return results[0];
    }
};
module.exports = User;