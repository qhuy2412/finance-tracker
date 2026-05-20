---
trigger: always_on
---

# Code Quality Rules

## Core Mindset
- Less code = less debt. Accomplish goals with **minimal code changes**.
- Only modify sections related to the task. Never touch unrelated code.
- Simple and working > clever and fragile.
- When in doubt: read the existing code first, match its style.

## Naming
- Use **descriptive names** — a variable name should explain what it holds without a comment.
- Event handlers: prefix with `handle` — `handleSubmit`, `handleWalletChange`.
- Booleans: prefix with `is/has/can` — `isLoading`, `hasError`, `canWithdraw`.
- Async functions: use verb that describes the action — `fetchWallets`, `createTransaction`.

## Control Flow
- **Use early returns** to avoid deep nesting:
  ```js
  // ✅ Good
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
  // ... main logic

  // ❌ Avoid
  if (userId) {
    if (wallet) {
      // ... main logic
    }
  }
  ```
- Avoid else when the if already returns.

## Functions
- Keep functions under **40 lines**. Split if longer.
- One function = one responsibility.
- If a function needs a comment to explain what it does, it should be split or renamed.

## Error Handling
- Wrap **all async operations** in try/catch — no unhandled promise rejections.
- Error response shape must be consistent: `{ message: string }`.
- Never expose stack traces or internal error details in production responses.
- Log errors server-side, return safe messages to client.

## Comments
- Only comment when logic is **genuinely non-obvious**.
- No comments that just restate what the code does:
  ```js
  // ❌ Bad: increment counter
  count++;

  // ✅ Good: offset by 1 because index is 0-based but UI displays 1-based
  displayIndex = index + 1;
  ```
- Use `// TODO:` prefix when noting a known issue or tech debt.
- Comment by English
## Forbidden Patterns
- No `console.log` in committed code — remove after debugging.
- No hardcoded URLs, secrets, or credentials — use environment variables.
- No `any` type workarounds that hide real issues.
- No commented-out code blocks — delete them, Git has history.
