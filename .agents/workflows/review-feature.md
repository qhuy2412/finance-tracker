---
description: Agent test and evaluate feature by itself
---

Steps
1. Understand the feature

Read all files related to this feature (frontend component + backend route + service)
Identify the user flow: what does the user do, what should happen
Note any edge cases or known constraints

2. Start the environment

Check if dev server is running on the expected ports
If not: start frontend (npm run dev) and backend (npm run dev) in background
Confirm both are healthy before proceeding

3. Test the happy path

Open browser → navigate to the relevant URL
Perform the exact user flow as a normal user would
Take a screenshot at each key step

4. Test edge cases

Submit the form with empty required fields
Submit with invalid data (wrong format, too long, special characters)
Double-click submit button rapidly → check for duplicate requests
Refresh mid-flow → check state recovery
Test with slow network (DevTools → Network → Slow 3G)

5. Test responsive

Resize browser to 375px width → check mobile layout
Resize to 1280px → check desktop layout
Confirm nothing overflows or breaks

6. Check for errors

Open DevTools Console → any JS errors or warnings?
Open DevTools Network → any failed requests (4xx / 5xx)?
Check API response shape: { success, data } or { success, error, code }

7. Report results
Create a Walkthrough artifact with:
Feature: [name]
Tested flows: [list]
Results:

✅ [what works]
⚠️ [what needs attention + detail]
❌ [bugs found + exact error + steps to reproduce]

Screenshots: [attach]
Recommendation: Ready to ship / Needs fix before shipping