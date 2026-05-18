const express = require('express');
const router = express.Router();
const { generateLinkToken, getLinkStatus, unlinkAccount } = require('../controller/telegramController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

router.post('/generate-link-token', generateLinkToken);   // POST /api/telegram/generate-link-token
router.get('/status', getLinkStatus);                      // GET  /api/telegram/status
router.delete('/unlink', unlinkAccount);                   // DELETE /api/telegram/unlink

module.exports = router;