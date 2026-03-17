const db = require("../config/db");
const Category = require("../model/categoryModel");

const getCategoryList = async (req, res) => {
    try {
        const userId = req.user.id;
        const categories = await Category.getAllCategoriesByUserId(userId);
        return res.status(200).json(categories);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {getCategoryList};