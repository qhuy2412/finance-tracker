---
name: uiux-testing
description: Review UI/UX quality of a React component or page. Use when user pastes code or uploads a screenshot and asks for UI feedback, design review, or improvement suggestions.
---

# SKILL: UI/UX Testing Agent

## Purpose
Guide an agent to review the UI/UX quality of a React component or web page, providing specific and actionable feedback.

---

## When to use this skill
- User pastes a component and asks "does this look good?" or "what can be improved?"
- User uploads a screenshot and wants UI feedback
- User asks "review my UI/UX"
- User wants to compare two UI versions

---

## Testing Workflow (in order)

### STEP 1 — Gather context
Before reviewing, the agent must know:
- **Target user**: general public, finance professionals, developers...?
- **Primary device**: desktop or mobile?
- **Page goal**: what does the user need to accomplish here?

If no context is provided → infer from the app name, page content, and component structure.

---

### STEP 2 — Evaluate across 7 criteria

#### 2.1 Visual Hierarchy
Questions to ask:
- Where does the eye go first?
- Is the most important information visually dominant?
- Do font sizes and weights create a clear hierarchy?

Checklist:
- [ ] One clear focal point per screen (hero, CTA, key metric)
- [ ] Heading > subheading > body is visually distinct
- [ ] No more than 3 font size levels on a single screen

---

#### 2.2 Spacing & Layout
Questions to ask:
- Do elements have room to breathe (enough whitespace)?
- Are padding and margin values consistent?
- Is the grid properly aligned?

Checklist:
- [ ] Card padding is consistent (not 16px in one place, 24px in another)
- [ ] Section spacing is sufficient to visually separate content
- [ ] No element is flush against its container edge

---

#### 2.3 Color & Contrast
Questions to ask:
- Is text contrast sufficient against its background? (WCAG AA minimum: 4.5:1)
- Are colors used consistently as a system?
- Do colors convey the right meaning/emotion?

Checklist:
- [ ] Body text (#slate-800 or darker) on white background ✓
- [ ] Secondary text (#slate-400) is not used for critical information
- [ ] No more than 3 primary colors across the UI
- [ ] Red/green reserved for status only (error/success)

---

#### 2.4 Component Consistency
Questions to ask:
- Do same-type buttons share the same style?
- Is border-radius consistent throughout?
- Are icons from the same library (don't mix lucide + heroicons)?

Checklist:
- [ ] Primary button: one color used consistently
- [ ] Border radius: pick one (rounded-lg / rounded-xl / rounded-2xl) and stick to it
- [ ] Icon sizes consistent within the same context (nav: 18px, inline: 16px)

---

#### 2.5 Feedback & States
Questions to ask:
- Are hover states present?
- Is there a loading state during API calls?
- What does the empty state look like (no data)?
- Are error states handled?

Checklist:
- [ ] Buttons have hover styles
- [ ] Inputs have a visible focus ring
- [ ] Loading indicator shown on form submit
- [ ] Error message shown when API fails
- [ ] Empty state shown when list has no items

---

#### 2.6 Form & Input Design
Questions to ask:
- Is it obvious what each field expects?
- Can the user tell when they've made a mistake — and how to fix it?
- Is the form easy to complete without thinking?

Checklist:
- [ ] Every input has a visible label (not just placeholder — placeholder disappears on type)
- [ ] Placeholder text is an example, not the label (`e.g. john@email.com` not `Enter your email`)
- [ ] Required fields are marked clearly (`*` or "Required")
- [ ] Input type matches content: `type="email"`, `type="tel"`, `type="password"` etc.
- [ ] Password field has a show/hide toggle
- [ ] Inline validation — error appears below the field, not in a toast far away
- [ ] Error message explains what's wrong AND how to fix it (`"Password must be at least 8 characters"` not just `"Invalid"`)
- [ ] Success state is shown after submission (not just a redirect with no feedback)
- [ ] Submit button is disabled or shows loading while request is in flight (prevent double submit)
- [ ] Tab order follows logical reading order (top to bottom, left to right)
- [ ] Form fields are grouped logically (personal info together, payment info together)
- [ ] No more than 5–7 fields visible at once — use steps/sections if more are needed

Common anti-patterns to flag:
- ❌ Label only as placeholder (disappears when user types — they forget what the field is)
- ❌ Red border on error with no explanation text
- ❌ Generic error: `"Something went wrong"` with no actionable fix
- ❌ Confirmation password field with no real-time match indicator
- ❌ Submit button always enabled — user clicks, nothing happens, no feedback
- ❌ Input too narrow to read what was typed

---

#### 2.7 Responsiveness
Questions to ask:
- Does the layout break at 375px (mobile)?
- Is text readable on mobile? (minimum 14px)
- Are touch targets large enough? (minimum 44×44px)

Checklist:
- [ ] Grid collapses to 1 column on mobile
- [ ] No hidden horizontal scroll
- [ ] Buttons and links are large enough to tap with a finger

---

### STEP 3 — Output format

Agent responds using this structure:

```
## Overview
[1–2 sentences: overall impression, main strengths and weaknesses]

## ✅ What works well
- [specific point with explanation of why it works]

## ⚠️ Needs improvement
- [issue] → [specific solution, with code snippet if applicable]

## 🔴 Critical issues (if any)
- [issue that directly hurts usability or accessibility]

## Recommended next steps
[Top 1–2 things to fix first, prioritized by impact]
```

---

### STEP 4 — Code fix (if requested)

If the user wants fixes applied:
1. Only change what was flagged in Step 3
2. Explain each change with an inline comment
3. Do not refactor the entire component unless explicitly asked

---

## Example

**Input:** User pastes `Wallets.jsx` and asks "anything to improve?"

**Agent does:**
1. Reads code → identifies: wallet management page, fintech app, desktop-first
2. Runs through all 7 criteria
3. Finds: no empty state, missing mobile hover handling, `max-w-3xl` causes layout misalignment
4. Outputs using the format above
5. Asks: "Want me to apply these fixes?"

---

## Important rules

- **Never give vague feedback** ("looks fine", "pretty good") — always be specific
- **Always pair a problem with a solution**
- **Prioritize by impact**: Usability > Visual polish > Code style
- **Ask for context** if the page goal is unclear before reviewing
- **Don't impose personal taste** — base feedback on principles, not preferences