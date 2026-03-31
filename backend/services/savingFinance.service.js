const { v4: uuidv4 } = require('uuid');
const Saving = require('../model/savingModel');
const { createHttpError } = require('./financeErrors');

const savingFinance = {
    async createSaving(userId, params = {}) {
        const { name, target_amount, current_amount, deadline } = params;
        if (!name || target_amount === undefined) {
            throw createHttpError(400, 'Name, target_amount are required!');
        }
        if (Number(target_amount) < 0) {
            throw createHttpError(400, 'Target amount must be a positive number!');
        }

        const savingId = uuidv4().trim();
        await Saving.createSaving(
            savingId,
            userId,
            name,
            Number(target_amount),
            current_amount === undefined ? 0 : Number(current_amount),
            deadline || null
        );
        return { message: 'Saving goal created successfully!' };
    },
};

module.exports = savingFinance;

