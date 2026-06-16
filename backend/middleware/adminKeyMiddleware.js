/**
 * adminKeyMiddleware.js
 * Protects internal admin-only endpoints using a pre-shared API key.
 *
 * The caller must supply the key in the request header:
 *   X-Admin-Key: <value of ADMIN_API_KEY in .env>
 *
 * This is intentionally separate from JWT auth — it is meant for
 * server-to-server calls or trusted admin tooling, not end-user sessions.
 */

const adminKeyMiddleware = (req, res, next) => {
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    // Fail closed: if key is not configured, block all access.
    console.error('[AdminKey] ADMIN_API_KEY is not set — blocking request.');
    return res.status(403).json({ message: 'Admin access is not configured.' });
  }

  const providedKey = req.headers['x-admin-key'];

  if (!providedKey || providedKey !== adminKey) {
    return res.status(403).json({ message: 'Forbidden: Invalid or missing admin key.' });
  }

  next();
};

module.exports = adminKeyMiddleware;
