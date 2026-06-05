const Notification = require('../model/notificationModel');

const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.getByUserId(userId);
    res.json(notifications);
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await Notification.countUnread(userId);
    res.json({ count });
  } catch (err) {
    next(err);
  }
};

const markRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await Notification.markRead(id, userId);
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await Notification.markAllRead(userId);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead };
