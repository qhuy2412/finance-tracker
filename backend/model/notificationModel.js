const db = require('../config/db');

const Notification = {
  /**
   * Insert a new notification for a user.
   */
  create: async (id, userId, type, title, body) => {
    await db.execute(
      'INSERT INTO notifications (id, user_id, type, title, body) VALUES (?, ?, ?, ?, ?)',
      [id, userId, type, title, body]
    );
  },

  /**
   * Fetch the latest 30 notifications for a user (unread first, then by date desc).
   */
  getByUserId: async (userId) => {
    const [rows] = await db.execute(
      `SELECT id, type, title, body, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY is_read ASC, created_at DESC
       LIMIT 30`,
      [userId]
    );
    return rows;
  },

  /**
   * Count unread notifications for a user (used for badge).
   */
  countUnread: async (userId) => {
    const [[{ count }]] = await db.execute(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return Number(count);
  },

  /**
   * Mark a single notification as read. Ownership check included.
   */
  markRead: async (notificationId, userId) => {
    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
  },

  /**
   * Mark all notifications as read for a user.
   */
  markAllRead: async (userId) => {
    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );
  },

  /**
   * Check if a notification of the given type was already sent today.
   * Used to prevent duplicate alerts on scheduler restart.
   */
  hasToday: async (userId, type) => {
    const [[{ count }]] = await db.execute(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = ? AND type = ? AND DATE(created_at) = CURDATE()`,
      [userId, type]
    );
    return Number(count) > 0;
  },
};

module.exports = Notification;
