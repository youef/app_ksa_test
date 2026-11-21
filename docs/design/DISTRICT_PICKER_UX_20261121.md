# District Picker UX Plan — 2026-11-21

## Scope
One screen only: `app/districts.tsx` (choose a residential district for a city). No routing, location data, GPS locking, persistence, or other screens are changed.

## Current-state review (before)
- Search filters with raw `name.includes`, so Arabic spelling variants/diacritics do not match consistently.
- The screen has no visible result count, no clear-search action, and no empty-result recovery; an unmatched query silently renders a blank list.
- District rows have 38px pin surfaces and no explicit minimum row height or accessibility label/state.
- The list has a fixed 100px trailing spacer in addition to the bottom-nav inset.
- Several imports and legacy hero styles are unused; the page is visually less aligned with the existing 44px Oasis touch target and 16–18px card radius.

## Design direction
Keep the existing Oasis tokens, AppHeader and bottom-navigation integration. Introduce a calm, compact location-selection hierarchy:
1. Search field: 52px height, RTL, 44px clear button, clear accessible label, native search keyboard action.
2. Context row: city/region context and localized count of visible districts; count changes with the query and is not shown as an interactive control.
3. District cards: 76px minimum height, 18px radius, 12–14px padding, 44px pin icon surface, clear typography hierarchy, subtle token border/selected-ready contrast (no new hard-coded palette), and 44px minimum interactive height.
4. Empty state: concise Arabic explanation, search-aware copy, and one 44px recovery action to clear the query. It must not imply that the city has no districts when only the search has no matches.
5. Selection feedback: disable other district rows while saving, expose busy state and label for the active row, and restore the controls in `finally`. Keep current GPS-city lock, persistence, account-cache behavior and destination unchanged.

## Responsive and platform behavior
- RTL remains explicit for row and search layouts; search text is right-aligned.
- Content is centered with a 720px max width on large screens, while using full width on phone.
- Scroll padding uses the existing `useBottomNavInset` value; remove the redundant 100px spacer.
- Preserve AppHeader safe-area behavior and existing bottom dock. No fixed heights for the page or list.

## Accessibility and motion
- Explicit labels for search, clear action, and each district row; announce row state while selection is in progress.
- Search and recovery actions have at least 44px hit areas; card text remains readable and is capped to two lines where necessary.
- Use a non-animated loading indicator on the selected row; no decorative motion, respecting reduced-motion defaults.

## Before / after acceptance
- Before: raw Arabic search, no count or no-results recovery, 38px pin, inconsistent 14px radius, fixed trailing gap.
- After: normalized Arabic query matching, count, accessible 44px clear action, contextual empty state, 44px icon and 76px row, 18px card radius, capped responsive content, natural bottom inset.

## Validation plan
- Add focused tests for Arabic normalization matching, blank query, and unmatched query.
- Add UI-contract tests for the search/clear/count/empty-state accessibility, touch-target/card sizing, capped layout, and bottom-nav inset.
- Run the focused Node tests and TypeScript/Web/full-suite checks if a runnable checkout exists. Report checks not executed rather than implying they passed.
- Draft PR only. Do not merge or deploy before all required CI checks and human review.
