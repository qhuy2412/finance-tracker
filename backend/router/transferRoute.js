const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const transferController = require('../controller/transferController');

router.post('/', authMiddleware, transferController.transferMoney);

module.exports = router;
