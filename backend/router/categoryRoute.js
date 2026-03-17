const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const categoryController = require('../controller/categoryController');

router.get('/', authMiddleware, categoryController.getCategoryList);

module.exports = router;