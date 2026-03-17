const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const walletController = require('../controller/walletController');

router.get('/', authMiddleware, walletController.getAllWallets);
router.post('/', authMiddleware, walletController.createWallet);

module.exports = router;