---
trigger: always_on
---

# Frontend Rules (React 19 / Zustand / Tailwind CSS v4)

## Component Design
- One component = one responsibility. If a component needs scrolling to read, split it.
- Keep components under **150 lines**. Extract sub-components or custom hooks if longer.
- Props should be minimal — if passing >5 props, consider using a context or restructuring.
- Compose small components into larger ones, not the reverse.

## State Management
| State type | Where |
|---|---|
| Cross-page / persisted | Zustand store (`src/store/`) |
| Single component | `useState` |
| Derived from props | computed inline, no state needed |
| Server data | fetch in component or store, cache in store |

- Never duplicate state — derive it from a single source of truth.
- After mutate (POST/PUT/DELETE), always refetch or update the store — stale UI is a bug.

## API Calls
- All API calls go through `src/services/apiService.js` — never call `axios` directly in components.
- Base URL comes from `import.meta.env.VITE_API_URL` — never hardcode `localhost:9999`.
- Wrap every API call in try/catch and show user-visible error via toast.

```jsx
// ✅ Correct pattern
const handleSubmit = async () => {
  try {
    setLoading(true);
    await apiService.createTransaction(data);
    toast.success('Giao dịch đã được thêm');
    onSuccess(); // refetch or update store
  } catch (err) {
    toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
  } finally {
    setLoading(false);
  }
};
```

## UX Patterns
- **Loading states**: show skeleton or spinner — never let UI hang silently.
- **Empty states**: always handle empty list — show a meaningful message, not blank space.
- **Error states**: show error message, not just "Something went wrong".
- **Destructive actions**: always require confirmation (modal/dialog) before delete.
- **Forms**: disable submit button while loading to prevent double submission.

## Styling (Tailwind v4)
- Use Tailwind utility classes. No inline `style={{}}` unless for dynamic values that Tailwind can't handle.
- No separate CSS files unless for complex animations.
- Responsive: design mobile-first. Test at `375px` and `1280px`.
- Use `cn()` utility (from `src/lib/`) to conditionally merge classes.

## Performance
- Avoid unnecessary re-renders: don't create objects/arrays inline in JSX that cause reference changes.
- Use `useCallback` only when passing handlers to memoized child components — don't over-optimize.
- Images: use proper `alt` text and appropriate sizes.

## Forbidden Patterns
- No direct DOM manipulation (`document.getElementById`) — use React state/refs.
- No `useEffect` with missing dependencies — fix the lint warning, don't suppress it.
- No prop drilling beyond 2 levels — use Zustand store instead.
- No `key={index}` for dynamic lists where items can be reordered or deleted — use stable IDs.
