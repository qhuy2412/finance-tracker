const { v4: uuidv4 } = require('uuid');
const Category = require('../model/categoryModel');
const { createHttpError } = require('./financeErrors');

const categoryFinance = {
    async createCategory(userId, { name, type, color, icon }) {
        if (!name || !type) {
            throw createHttpError(400, 'Name and type are required!');
        }

        const existingCategory = await Category.findByName(userId, name);
        if (existingCategory) {
            throw createHttpError(400, 'Category name already exists!');
        }

        const categoryId = uuidv4().trim();
        await Category.createCategory(categoryId, userId, name, type, color, icon);
        return { message: 'Category created successfully!' };
    },
};

module.exports = categoryFinance;

