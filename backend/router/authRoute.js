const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controller/authController');
const authMiddleware = require('../middleware/authMiddleware');

// ── Rate limiters ──────────────────────────────────────────────────────────
// Giới hạn login/register: 10 request / 15 phút / IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' },
});

// OTP verify: 5 lần / 15 phút (giới hạn chặt hơn vì chỉ có 1.000.000 khả năng)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Quá nhiều lần xác thực. Vui lòng thử lại sau 15 phút.' },
});

router.post('/register', authLimiter, authController.register);
router.post('/verify-email', otpLimiter, authController.verifyEmail);
router.post('/login', authLimiter, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authController.logout);

module.exports = router;