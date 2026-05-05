---
trigger: always_on
---

After every change that affects UI or any API endpoint:

Start dev servers if not running:

Frontend: npm run dev (port 5173 or 3000)
Backend: npm run dev (port 9999)


Open browser and navigate to the relevant URL
Perform the full user flow as a real user — not just visual inspection
Open DevTools → check Console for JS errors and Network tab for failed requests
Take a screenshot before and after the change
Test responsive: mobile 375px and desktop 1280px
Report results:

✅ Works as expected
⚠️ Works but needs attention (describe what)
❌ Bug found (describe behavior + console/network error)



Key Flows to Test After Changes

Auth: Register → Verify email (if any) → Login → Logout
Core CRUD: Create → Read (list + detail) → Update → Delete
Error states: submit empty form, invalid input, network error
Protected routes: confirm unauthorized users are redirected

API Testing (when backend changes)

Use browser DevTools Network tab to inspect request/response
Verify: correct HTTP status code, consistent JSON shape, no stack traces in response
Test both happy path and error cases (invalid input, missing auth)

Test Accounts (store locally, never commit)
Regular user: see .env