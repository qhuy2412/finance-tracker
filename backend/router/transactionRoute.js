const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const transactionController = require('../controller/transactionController');

router.get('/:walletId', authMiddleware, transactionController.getAllTransactionsByWalletId);
router.post('/:walletId', authMiddleware, transactionController.createNormalTransaction);
router.put('/:transactionId', authMiddleware, transactionController.updateTransaction);
router.delete('/:transactionId', authMiddleware, transactionController.deleteTransaction);
router.get('/', authMiddleware, transactionController.getTransactionsByUserId);

module.exports = router;