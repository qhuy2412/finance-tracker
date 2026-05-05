---
description: Review current git diff like a senior JavaScript developer — logic, security, performance, code style
---

1. Get the diff to review.
// turbo
2. Run `git diff main...HEAD`

3. If empty, get current changes.
// turbo
4. Run `git diff HEAD`

5. Read the changed files in full for context (not just the diff lines).

6. Review across 5 dimensions — JavaScript specific:

   ### Logic & Correctness
   - Does the code actually do what it's supposed to?
   - Unhandled edge cases: null/undefined, empty array, 0, NaN, negative numbers?
   - Async code: missing await? Promise swallowed without .catch()?
   - Callback errors ignored? (first argument in Node callbacks)
   - Any == instead of === that could cause type coercion bugs?

   ### Security
   - User input used in DB query without sanitization? (SQL injection / NoSQL injection)
   - User input rendered in HTML without escaping? (XSS)
   - Passwords or tokens logged or returned in API response?
   - Auth middleware missing on protected routes?
   - Hardcoded secrets or API keys in source?
   - process.env values exposed to frontend (React)?

   ### Performance
   - await inside a loop when Promise.all() would work? (sequential vs parallel)
   - DB query inside a loop? (N+1 problem)
   - No pagination on list endpoints — could return thousands of records?
   - setInterval or event listener created but never cleared? (memory leak)
   - Heavy computation blocking the event loop?

   ### Code Quality (JS specific)
   - var used instead of const/let?
   - console.log left in that should be removed?
   - Callback hell that could be async/await?
   - Error swallowed silently: catch(err) {} with empty body?
   - Magic numbers or strings with no explanation?
   - Function longer than 40 lines that should be split?

   ### Express / Node specific
   - async route handler without try/catch or asyncHandler wrapper?
   - res.json() called after headers already sent?
   - Missing next(err) in error middleware?
   - req.body used without body-parser / express.json() middleware?
   - CORS configured correctly for the environment?

7. Output structured review:

---
## Code Review Report

### Summary
[2-3 sentence overall assessment]

### Issues Found

#### 🔴 Must fix
- [issue] — [file:line] — [why] — [fix]

#### 🟡 Should fix
- [issue] — [file:line] — [why] — [fix]

#### 🟢 Nice to have
- [suggestion] — [file:line] — [reason]

### What's done well
- [at least one positive]

### Verdict
[ ] Ready to ship
[ ] Fix critical issues first
[ ] Needs rework
---

8. Ask: "Want me to fix any of these? Which ones?"