---
description: Create a new react component that complies with project standard
---

Steps
1. Clarify requirements
Before writing any code, confirm:

Component name (PascalCase)
Where it lives: shared components/ or page-specific?
Props it receives (types, required vs optional)
Does it call an API? Which endpoint?
Does it need global state? Which store?
Any specific UI behavior: loading state, error state, empty state?

2. Define TypeScript types

Define the Props interface at the top of the file
If the component fetches data, define the response type
If reused elsewhere, export types to src/types/

3. Create the component file
File: frontend/src/components/[Name]/[Name].tsx
Structure inside the file:
imports
↓
type definitions
↓
component function
  → loading state
  → error state
  → empty state
  → main render
↓
export
Rules:

const ComponentName = ({ prop1, prop2 }: Props) => { ... }
Named export only — no default export
Handle all three states: loading / error / empty
No inline styles — use Tailwind classes only

4. API integration (if needed)

Create or update frontend/src/services/[resource].service.ts
Use React Query (useQuery / useMutation) — not useEffect + fetch
Handle optimistic updates for mutations where UX benefits

5. Create custom hook (if logic is complex)
File: frontend/src/hooks/use[Name].ts

Extract data fetching + state logic into a hook
Keep the component focused on rendering only

6. Browser test

Open browser → navigate to the page using this component
Verify: renders correctly, loading spinner shows, error message shows on failure
Test mobile 375px and desktop 1280px
Take screenshot

7. Summarize

Component created: [Name].tsx
Props: [list]
API call: yes/no — endpoint used
State: local only / React Query / Zustand
Test result: ✅ / ⚠️ / ❌