const express = require('express');
const router = express.Router();
const billController = require('../controller/billController');
const  authMiddleware  = require('../middleware/authMiddleware');


router.post('/extract', authMiddleware, billController.extractBill);

module.exports = router;
