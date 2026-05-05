---
description: Run safety checklist before deploy to staging or production
---

1. Code quality check
Run in both frontend/ and backend/:
npm run lint          # zero errors required
npm run build         # must complete without errors
If any fail → stop, fix, re-run before continuing.
2. Security scan

Search codebase for hardcoded secrets: API keys, passwords, tokens
grep -r "secret\|password\|token\|apikey" src/ --include="*.ts" --include="*.tsx"
Confirm .env files are in .gitignore
Confirm no console.log in production code
Check .env.example is up to date with all required variables

3. Database migrations (if any)

List pending migrations
Review each migration: is it reversible? Does it have a rollback?
Confirm backup has been taken before running on staging/production
Do NOT run migrations automatically — list them and wait for approval

4. Build verification

Run production build locally
Start the production build and smoke test the main flows in browser
Confirm no runtime errors in the built output

5. Environment check

Confirm all required env vars are set in the target environment
Compare .env.example with target environment variables — flag any missing ones

6. Final report
Pre-deploy checklist for: [staging / production]
Date: [today]

✅ Lint: passed
✅ Type-check: passed
✅ Build: passed
✅ No hardcoded secrets found
✅ .env.example up to date
⚠️ Pending migrations: [list or "none"]
⚠️ Missing env vars in target: [list or "none"]

Recommendation: [READY TO DEPLOY / BLOCKED — fix X first]

Awaiting your approval to proceed.