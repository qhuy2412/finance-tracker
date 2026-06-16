/**
 * schedulerRoute.js
 * Admin-only routes for managing background job schedules.
 * Protected by a pre-shared API key (X-Admin-Key header).
 */

const express = require('express');
const router = express.Router();
const adminKey = require('../middleware/adminKeyMiddleware');
const { getSchedules, updateSchedule } = require('../controller/schedulerController');

router.get('/', adminKey, getSchedules);
router.put('/', adminKey, updateSchedule);

module.exports = router;
