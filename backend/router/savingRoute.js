const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const savingController = require('../controller/savingController');

router.post('/', authMiddleware, savingController.createSaving);
router.get('/', authMiddleware, savingController.getAllSavings);
router.put('/:id', authMiddleware, savingController.updateProgress);
router.delete('/:id', authMiddleware, savingController.deleteSaving);

module.exports = router;