---
description: Debugging errors systematically
---

Steps
1. Reproduce the bug

Identify exact steps to trigger the bug
Confirm the bug is reproducible consistently
Note: which environment? (local / staging / production)

2. Locate the error
Frontend errors:

Open DevTools Console → read the full error + stack trace
Open DevTools Network → find the failed request → check request payload + response body
Note the exact component and line number from the stack trace

Backend errors:

Check terminal running the server for error logs
Check the API response body for the error message and code
If database error: check query logs or ORM output

3. Read the relevant code

Open the files identified in step 2
Read the code flow from entry point (route → controller → service → DB)
Identify where the assumption breaks down

4. Form a hypothesis
Before making any change, state clearly:

"I think the bug is caused by [X]"
"Evidence: [Y]"
"Fix: [Z]"

5. Apply the fix

Make the smallest change that fixes the root cause
Do not refactor or clean up other things at the same time
Do not patch symptoms — fix the root cause

6. Verify the fix

Reproduce the original bug steps → confirm bug is gone
Test adjacent functionality → confirm nothing else broke
Check DevTools Console and Network → no new errors

7. Report
Bug: [description]
Root cause: [what was actually wrong]
Fix applied: [what was changed and why]
Verified: ✅ bug gone, no regression / ❌ still failing (new hypothesis below)