const {v4: uuidv4} = require('uuid');
const Saving = require('../model/savingModel');
const financeService = require('../services/financeService');
const createSaving = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await financeService.createSaving(userId, req.body);
        return res.status(201).json(result);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ message: error.message });
    }
};
const updateProgress = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { add_amount } = req.body; 

    try {
        const [goals] = await require('../config/db').execute(
            'SELECT current_amount, target_amount FROM saving_goals WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        if (!goals[0]) return res.status(404).json({ message: "Saving goal not found!" });
        if (add_amount > goals[0].target_amount - goals[0].current_amount) return res.status(400).json({ message: "You cannot add more than the remaining amount!" });
        const newAmount = parseFloat(goals[0].current_amount) + parseFloat(add_amount);
        const status = newAmount >= parseFloat(goals[0].target_amount) ? 'COMPLETED' : 'IN_PROGRESS';

        await require('../config/db').execute(
            'UPDATE saving_goals SET current_amount = ?, status = ? WHERE id = ?',
            [newAmount, status, id]
        );

        res.status(200).json({ 
            message: "Saving progress updated successfully!",
            current_progress: newAmount,
            status: status
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAllSavings = async (req, res) => {
    const userId = req.user.id;
    try {
        const savings = await Saving.getAllSavingsByUserId(userId);
        res.status(200).json(savings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteSaving = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await Saving.deleteSaving(id, userId);
        res.status(200).json({ message: "Saving goal deleted successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { createSaving, updateProgress, getAllSavings, deleteSaving };