const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const debtController = require('../controller/debtController');

router.get('/:walletId', authMiddleware, debtController.getAllDebts);
router.post('/:walletId', authMiddleware, debtController.createDebt);
// router.delete('/:debtId', authMiddleware, debtController.deleteDebt);

module.exports = router;