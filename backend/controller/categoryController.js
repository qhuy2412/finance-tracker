const db = require("../config/db");
const Category = require("../model/categoryModel");
const { v4: uuidv4 } = require('uuid');
const financeService = require('../services/financeService');

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
        const result = await financeService.createCategory(userId, { name, type, color, icon });
        return res.status(201).json(result);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ message: error.message });
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