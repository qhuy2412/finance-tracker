/**
 * schedulerController.js
 * Handles admin requests to view and update background job schedules.
 */

const cron = require('node-cron');
const db = require('../config/db');
const { broadcastReload } = require('../services/schedulerService');

/**
 * GET /api/admin/scheduler
 * Returns all current job schedules from the database.
 */
const getSchedules = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      'SELECT job_name, cron_expression, updated_at FROM scheduler_settings ORDER BY job_name'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/scheduler
 * Updates the cron expression for a specific job and triggers a live reload on all instances.
 *
 * Body: { job_name: string, cron_expression: string }
 */
const updateSchedule = async (req, res, next) => {
  try {
    const { job_name, cron_expression } = req.body;

    if (!job_name || !cron_expression) {
      return res.status(400).json({ message: 'job_name and cron_expression are required.' });
    }

    if (!cron.validate(cron_expression)) {
      return res.status(400).json({ message: 'Invalid cron expression.' });
    }

    const [result] = await db.execute(
      'UPDATE scheduler_settings SET cron_expression = ? WHERE job_name = ?',
      [cron_expression, job_name]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: `Job "${job_name}" not found.` });
    }

    // Broadcast reload to this instance and all other connected VMs
    await broadcastReload();

    res.json({ message: `Schedule for "${job_name}" updated successfully.` });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSchedules, updateSchedule };
