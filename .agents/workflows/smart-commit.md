---
description: Read git diff and auto-generate a conventional commit message, then commit
---

1. Check current git status to see what has changed.// turbo
2. Run git status
3. Read the full diff of staged and unstaged changes.// turbo
4.Run git diff HEAD
5.Analyze the diff carefully:

    - What files changed?
    - What is the purpose of the change? (new feature, bug fix, refactor, chore...)
    - What is the scope? (auth, api, frontend, db, config...)


6. Generate a commit message following this format:
    - description under 36 chars Types: feat | fix | refactor | chore | docs | test | perf | style
    - Examples:
      feat(auth): add JWT refresh token endpoint
      fix(cart): prevent duplicate item on rapid double-click
      refactor(userService): extract validation into helper function
      chore(deps): upgrade express to 4.19

7. Show the proposed commit message to the user and ask: "Commit with this message? (yes / edit)"
8. If confirmed:// turbo
9. Run git add -A // turbo
10. Run git commit -m "[generated message]"
11. Report: committed successfully with message + files included.
Note: Only commit by english, short but describe full of change