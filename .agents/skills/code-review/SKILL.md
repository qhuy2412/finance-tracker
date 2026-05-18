---
name: code-review
description: >
  Review and automatically fix codebases, files, or code snippets. Use this skill whenever the user wants
  to review code quality, find bugs, security vulnerabilities, performance issues, or bad practices —
  and then optionally apply fixes. Triggers on: "review my code", "check my codebase", "find bugs",
  "review this file", "what's wrong with this code", "improve my code", "code audit", "refactor",
  "clean up code", "fix issues in my project". Use even when user says things like "look at my repo",
  "check if my code is good", or pastes a code snippet and asks for feedback. Always use this skill
  when a codebase, directory, or code file is mentioned alongside any request for analysis or improvement.
---

# Code Review Skill

A two-phase skill: **Review** (analyze and surface issues) then **Fix** (apply targeted patches).

---

## Phase 1: Discovery & Scoping

Before reviewing, understand what you're working with.

### Input types
- **Single file** — user pastes or uploads one file
- **Directory / repo** — user provides a path or uploads multiple files
- **Snippet** — inline code in the chat message

### Scoping steps
1. List files if given a directory: `find <path> -type f | grep -E '\.(js|ts|py|go|java|cs|php|rb|vue|jsx|tsx|css|scss|html)$' | head -60`
2. Check for config files: `package.json`, `pyproject.toml`, `go.mod`, `.eslintrc`, etc. — these tell you the tech stack and existing rules.
3. Ask the user if scope is ambiguous (e.g., monorepo with many services — which service?).
4. Identify the **primary language/framework** — tailor review criteria accordingly.

---

## Phase 2: Review

Run a structured analysis across six dimensions. For each issue found, record it in the standard Issue format (see below).

### Six Review Dimensions

#### 1. 🐛 Bugs & Correctness
- Logic errors, off-by-one, null/undefined dereferences
- Incorrect async/await usage, missing error handling
- Race conditions, infinite loops
- Wrong data types or implicit coercions

#### 2. 🔒 Security
- SQL injection, XSS, CSRF, path traversal
- Hardcoded secrets, API keys, passwords
- Insecure deserialization, prototype pollution
- Missing authentication/authorization checks
- Improper input validation

#### 3. ⚡ Performance
- N+1 queries, missing indexes (if DB code present)
- Unnecessary re-renders (React/Vue)
- Memory leaks, large bundle sizes
- Blocking operations on async code paths
- Inefficient algorithms (O(n²) where O(n log n) is possible)

#### 4. 🏗️ Code Quality & Maintainability
- Functions >50 lines (split them)
- Deeply nested conditionals (>3 levels — flatten)
- Magic numbers/strings (extract to constants)
- Dead code, commented-out code blocks
- Duplicate logic (DRY violations)
- Poor naming (single-letter vars outside loops)

#### 5. 🧪 Test Coverage
- Missing tests for critical paths
- Tests without assertions
- No error case tests
- Mocking anti-patterns

#### 6. 📐 Style & Conventions
- Inconsistent formatting (only flag if no linter config present)
- Missing docstrings/JSDoc for public APIs
- Import ordering issues
- Framework-specific anti-patterns (e.g., mutating state in React, `SELECT *` in SQL)

### Issue Format

For every issue found, output in this structure:

```
### [SEVERITY] TITLE
- **File**: `path/to/file.ext`, line X–Y
- **Dimension**: Bug / Security / Performance / Quality / Test / Style
- **Problem**: One sentence explaining what's wrong.
- **Fix**: Concrete suggestion or code snippet.
```

Severity levels:
- 🔴 **CRITICAL** — security hole or data loss risk; must fix
- 🟠 **HIGH** — bug that will cause failures in normal usage
- 🟡 **MEDIUM** — bad practice, performance issue, maintainability problem
- 🔵 **LOW** — style, naming, minor improvements

---

## Phase 3: Summary Report

After listing all issues, output a summary block:

```
## Summary
| Dimension      | Critical | High | Medium | Low |
|----------------|----------|------|--------|-----|
| Bugs           |          |      |        |     |
| Security       |          |      |        |     |
| Performance    |          |      |        |     |
| Quality        |          |      |        |     |
| Tests          |          |      |        |     |
| Style          |          |      |        |     |

**Overall health**: 🟢 Good / 🟡 Needs work / 🔴 Critical issues found

**Top 3 priorities:**
1. ...
2. ...
3. ...
```

Then ask: **"Bạn muốn tôi tự động fix các issue không? Nếu có, chọn: (A) Fix tất cả, (B) Chỉ fix Critical + High, (C) Chọn issue cụ thể"**

---

## Phase 4: Auto-Fix

When the user wants fixes applied:

### Fix workflow
1. **Plan first** — list every file that will be changed and what change will be made. Get confirmation if >3 files.
2. **Apply minimal diffs** — change only what's needed; don't reformat unrelated code.
3. **One issue at a time** — fix, verify, then move to next. Don't batch-edit a file for multiple issues in one pass (increases error risk).
4. **Show diff** — after each fix, show a before/after diff or the changed lines.
5. **Don't fix style issues automatically** unless the user explicitly asked — these are subjective.

### Fix constraints
- Never change function signatures unless the bug requires it
- Never rename public APIs
- Preserve existing comments and docstrings
- If a fix requires a dependency, note it — don't add it silently
- If a fix is complex or uncertain, flag it and ask rather than guessing

### After all fixes
Output a **Fix Report**:
```
## Fix Report
✅ Fixed: [N] issues
⏭️ Skipped: [N] issues (reason)
⚠️ Needs manual attention: [list with explanation]
```

---

## Language-Specific Guidance

Read the relevant reference file for deeper language-specific patterns before reviewing:

| Language / Framework | Reference file |
|---------------------|----------------|
| JavaScript / TypeScript | `references/js-ts.md` |
| Python | `references/python.md` |
| React / Vue / Frontend | `references/frontend.md` |
| SQL / Database | `references/sql.md` |
| General (multi-lang) | Use the six dimensions above |

Only read reference files if you need extra pattern guidance — for simple files, the six dimensions are enough.

---

## Tone & Communication

- Lead with the most impactful issues — don't bury critical bugs under style notes.
- Be specific: bad → "this could be improved"; good → "line 42: `user.password` is logged to console, remove it."
- Don't lecture — if the code is generally good, say so.
- In Vietnamese context: respond in Vietnamese if the user wrote in Vietnamese; use English for code/technical terms.
- If the codebase is large (>20 files), ask which areas matter most before reviewing everything.

---

## Quick Reference: Common Fixes by Language

### JavaScript / TypeScript
```js
// ❌ Unhandled promise
fetchData().then(process)

// ✅ Handle rejection
fetchData().then(process).catch(console.error)
// or
try { await fetchData() } catch(e) { handleError(e) }
```

```js
// ❌ == comparison (type coercion)
if (value == null)

// ✅ Strict equality
if (value === null || value === undefined)
// or just: if (value == null) — actually OK for null check only
```

### SQL
```sql
-- ❌ N+1: querying in a loop
for user in users:
    db.query("SELECT * FROM orders WHERE user_id = ?", user.id)

-- ✅ Single JOIN query
SELECT u.*, o.* FROM users u LEFT JOIN orders o ON o.user_id = u.id
```