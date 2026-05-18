// In-memory token store: token -> { userId, createdAt }
// TODO: Replace with Redis when scaling to multi-instance
const linkTokens = new Map();

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const cleanupExpiredTokens = () => {
    const now = Date.now();
    for (const [token, data] of linkTokens.entries()) {
        if (now - data.createdAt > TOKEN_TTL_MS) {
            linkTokens.delete(token);
        }
    }
};
const _cleanupTimer = setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL_MS);
if (_cleanupTimer.unref) _cleanupTimer.unref();


const generateToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = 'FINTRA_';
    for (let i = 0; i < 6; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
};

const telegramLinkService = {
    /**
     * Generate a short-lived link token for the given userId.
     * Each user can only have one active token at a time (old one is removed).
     */
    generateLinkToken: (userId) => {
        // Remove any existing token for this user
        for (const [token, data] of linkTokens.entries()) {
            if (data.userId === userId) {
                linkTokens.delete(token);
            }
        }

        const token = generateToken();
        linkTokens.set(token, { userId, createdAt: Date.now() });
        return token;
    },

    /**
     * Verify and consume a link token.
     * Returns the userId if valid, null otherwise.
     */
    verifyAndConsumeLinkToken: (token) => {
        const data = linkTokens.get(token);
        if (!data) return null;

        const isExpired = Date.now() - data.createdAt > TOKEN_TTL_MS;
        linkTokens.delete(token);

        if (isExpired) return null;
        return data.userId;
    },
};

module.exports = telegramLinkService;
