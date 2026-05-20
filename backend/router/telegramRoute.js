const express = require('express');
const router = express.Router();
const { generateLinkToken, getLinkStatus, unlinkAccount, handleWebhook } = require('../controller/telegramController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route for Telegram webhook (called by Telegram API)
router.post('/webhook', handleWebhook);                    // POST /api/telegram/webhook

// Protected routes (require user login)
router.use(authMiddleware);

router.post('/generate-link-token', generateLinkToken);   // POST /api/telegram/generate-link-token
router.get('/status', getLinkStatus);                      // GET  /api/telegram/status
router.delete('/unlink', unlinkAccount);                   // DELETE /api/telegram/unlink

module.exports = router;