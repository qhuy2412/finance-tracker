---
description: Help the agent grasp the entire project context when starting a new session.
---

Steps
1. Read project config

Read GEMINI.md → understand product, tech stack, environment URLs
Read README.md → understand setup, architecture, known issues
Read package.json (frontend + backend) → confirm actual dependencies and scripts

2. Scan folder structure

List top-level directories
List src/ structure for both frontend and backend
Note any unusual folders or files not covered by GEMINI.md

3. Check Knowledge Items

List all existing KIs in the Knowledge directory
Read summaries of KIs relevant to today's work
Note: "KI exists for [module] — will reference instead of re-analyzing"

4. Check recent changes

Run: git log --oneline -10 → see what changed recently
If there are uncommitted changes: git status → note what's in progress

5. Verify environment

Check if dev servers can start (do not start unless asked)
Confirm required .env variables are present (check .env.example)
Note any missing setup that could block work

6. Confirm understanding
Summarize back in Vietnamese:
Dự án: [tên + mô tả ngắn]
Tech stack: [frontend stack] + [backend stack] + [database]
Tính năng chính: [list]
KIs có sẵn: [list hoặc "chưa có"]
Thay đổi gần đây: [từ git log]
Sẵn sàng nhận task: ✅
Sau đó hỏi: "Hôm nay bạn muốn làm gì?"