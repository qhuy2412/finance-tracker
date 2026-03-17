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
const createCategory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, type,color, icon } = req.body;
        if (!name || !type) {
            return res.status(400).json({ message: "Name and type are required!" });
        }
        const existingCategory = await Category.findByName(userId, name);
        if (existingCategory) {
            return res.status(400).json({ message: "Category name already exists!" });
        }
        const categoryId = uuidv4().trim();
        await Category.createCategory(categoryId, userId, name, type, color, icon);
        return res.status(201).json({ message: "Category created successfully!" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
const getCategoryById = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ message: "Category not found!" });
        }
        return res.status(200).json(category);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {getCategoryList, createCategory, getCategoryById};