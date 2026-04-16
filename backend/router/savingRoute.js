const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const savingController = require('../controller/savingController');
const { createSaving, getAllSavings, deleteSaving, depositSaving, withdrawSaving, disburseSaving, getSavingHistory, getReservedByWallet } = savingController;

router.post('/',               authMiddleware, savingController.createSaving);
router.get('/',                authMiddleware, savingController.getAllSavings);
router.get('/reserved',        authMiddleware, savingController.getReservedByWallet);
router.post('/:id/deposit',    authMiddleware, savingController.depositSaving);
router.post('/:id/withdraw',   authMiddleware, savingController.withdrawSaving);
router.post('/:id/disburse',   authMiddleware, savingController.disburseSaving);
router.get('/:id/history',     authMiddleware, savingController.getSavingHistory);
router.delete('/:id',          authMiddleware, savingController.deleteSaving);

module.exports = router;