const db = require("../config/db");
const { create } = require("./userModel");
const Category = {
    getAllCategoriesByUserId: async (userId) => {
        const [rows] = await db.execute('SELECT * FROM categories WHERE user_id IS NULL OR user_id = ?', [userId]);
        return rows;
    },
    findByName: async (userId, name) => {
        const [rows] = await db.execute(
            'SELECT * FROM categories WHERE (user_id IS NULL OR user_id = ?) AND name = ?',
            [userId, name]
        );
        return rows[0];
    },
    createCategory: async (categoryId, userId, name, type, color, icon) => {
        return await db.execute('INSERT INTO categories (id, user_id, name, type, color, icon) VALUES (?, ?, ?, ?, ?, ?)', [categoryId, userId, name, type, color, icon]);
    },
    findById: async (id) => {
        const [rows] = await db.execute('SELECT * FROM categories WHERE id = ?', [id]);
        return rows[0];
    }
};
module.exports = Category;