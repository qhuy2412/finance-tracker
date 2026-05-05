---
trigger: always_on
---

# Backend Rules (Express / Node.js / MySQL)

## Architecture
- **Controller** = request/response handling only. No business logic.
- **Model** = SQL queries only. No HTTP concerns (no req/res).
- **Router** = route definitions + middleware attachment only.
- If you find business logic in a router or SQL in a controller, move it.

## Ownership — Never Skip This
Every query that touches user data MUST filter by `user_id`:
```js
// ✅ Always
const wallets = await getWalletsByUserId(userId);

// ❌ Never — returns all users' data
const wallets = await getAllWallets();
```

## SQL — Parameterized Queries Only
```js
// ✅ Correct
const [rows] = await db.query('SELECT * FROM wallets WHERE id = ? AND user_id = ?', [id, userId]);

// ❌ SQL injection risk — never do this
const [rows] = await db.query(`SELECT * FROM wallets WHERE id = ${id}`);
```

## Controller Pattern
```js
const doSomething = async (req, res, next) => {
  try {
    const userId = req.user.id; // always from JWT, never from body
    const result = await someModel.action(userId, req.body);
    res.json(result);
  } catch (err) {
    next(err); // pass to global error handler
  }
};
```

## Input Validation
- Validate required fields at the top of the controller before any DB calls.
- Return `400` for bad input, `401` for unauthenticated, `403` for unauthorized, `404` for not found.
- Never trust `req.body` for `user_id` — always use `req.user.id` from JWT middleware.

## Sensitive Operations
- **DB schema changes**: always write a migration script, never ALTER in ad-hoc.
- **Balance mutations**: log before and after values when modifying wallet balance.
- **savings withdrawal logic**: do not modify `savingModel.js` without understanding contribution ratio impact.

## Response Format
```js
// Success
res.json({ data: result });          // or just res.json(result) for lists
res.status(201).json({ message: 'Created', id: newId });

// Error (handled globally)
{ message: 'Human-readable error description' }
```

## Auth
- JWT is verified by `middleware/auth.js` — attach it to every protected route.
- Never put auth logic inside controllers — it belongs in middleware.
- Cookie is httpOnly — frontend cannot and should not read it directly.
