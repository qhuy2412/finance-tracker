const db = require('../config/db');

/**
 * Insert or update a weekly report for a user.
 * Uses UPSERT so re-running the agent for the same week overwrites cleanly.
 */
const upsert = async (id, userId, weekStart, data) => {
  await db.execute(
    `INSERT INTO weekly_reports (id, user_id, week_start, data)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE data = VALUES(data)`,
    [id, userId, weekStart, JSON.stringify(data)]
  );
};

/**
 * Get the report for a user by week offset.
 * offset=0 → current week, offset=1 → last week, etc.
 * Uses DATE_SUB to calculate the target week_start rather than LIMIT/OFFSET
 * because mysql2 prepared statements don't support parameterized LIMIT.
 */
const getByOffset = async (userId, offset = 0) => {
  // Calculate the Monday of the target week in JS to avoid LIMIT/OFFSET issue
  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1 - offset * 7);
  monday.setHours(0, 0, 0, 0);
  const weekStart = monday.toISOString().slice(0, 10);

  return getByWeekStart(userId, weekStart);
};

/**
 * Get the report for a specific week_start date.
 */
const getByWeekStart = async (userId, weekStart) => {
  const [rows] = await db.execute(
    `SELECT data, week_start, created_at
     FROM weekly_reports
     WHERE user_id = ? AND week_start = ?`,
    [userId, weekStart]
  );
  if (!rows || rows.length === 0) return null;
  return {
    weekStart: rows[0].week_start,
    createdAt: rows[0].created_at,
    data: typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data,
  };
};

module.exports = { upsert, getByOffset, getByWeekStart };
