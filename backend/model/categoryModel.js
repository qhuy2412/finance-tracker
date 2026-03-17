const db = require("../config/db");
const { create } = require("./userModel");
const Category = {
    getAllCategoriesByUserId: async (userId) => {
        const [rows] = await db.execute('SELECT * FROM categories WHERE user_id IS NULL OR user_id = ?', [userId]);
        return rows;
    },
    createCategory: async (categoryId, userId, name, type) => {
        return await db.execute('INSERT INTO categories (id, user_id, name, type) VALUES (?, ?, ?, ?)', [categoryId, userId, name, type]);
    }
};
module.exports = Category;