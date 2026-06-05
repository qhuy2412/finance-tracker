const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controller/notificationController');

// All notification routes require authentication
router.use(auth);

router.get('/',              ctrl.getNotifications);
router.get('/unread-count',  ctrl.getUnreadCount);
router.patch('/read-all',    ctrl.markAllRead);
router.patch('/:id/read',   ctrl.markRead);

module.exports = router;
