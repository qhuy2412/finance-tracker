const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const budgetController = require('../controller/budgetController');

router.post('/', authMiddleware, budgetController.setBudget);
router.get('/', authMiddleware, budgetController.getBudgetStatus);
router.delete('/:id', authMiddleware, budgetController.deleteBudget);

module.exports = router;