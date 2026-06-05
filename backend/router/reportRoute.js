const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getWeeklyReport } = require('../controller/reportController');

// GET /api/reports/weekly?offset=0
router.get('/weekly', auth, getWeeklyReport);

module.exports = router;
