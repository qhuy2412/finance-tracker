const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const transactionController = require('../controller/transactionController');

router.get('/:walletId', authMiddleware, transactionController.getAllTransactionsByWalletId);
router.post('/:walletId', authMiddleware, transactionController.createNormalTransaction);
router.delete('/:transactionId', authMiddleware, transactionController.deleteTransaction);

module.exports = router;