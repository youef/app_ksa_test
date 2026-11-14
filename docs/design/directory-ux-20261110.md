# Directory UI design plan — 2026-11-10

## Scope
Only `app/directory.tsx` and directory-specific regression tests. No backend, authorization, security, or unrelated project work.

## Before (source inspection)
- Directory is RTL and uses OASIS colors, but filter buttons are 42 px high, clear-search hit target is 36 px wide, and reset link has no minimum touch size.
- Selected directory tabs have no spoken name; the reset action excludes the alphabetical sort, leaving no visible reset control when sort alone is changed.
- Error state is shown after existing cards and the retry action has no accessible label; empty state copy is not actionable enough.
- Cards show long text in a compact horizontal layout and no explicit accessible description for kind, verification and city.

## Design plan / acceptance criteria
1. Preserve existing OASIS identity, responsive max-width, header, safe bottom inset and RTL reading order.
2. Make all directory-specific actions at least 44px high/wide; add descriptive accessible labels and selected states to tabs, sorting and cards.
3. Keep content visible on refresh and provide a clear error alert and retry affordance.
4. Improve card text layout for narrow phones and large screens without changing business/service navigation or data queries.
5. Ensure reset is offered for search, kind, verification **and** alphabetical sort; maintain current filtering semantics.
6. Add source-based regression tests for key UI invariants; validate with existing GitHub CI typecheck and web/platform builds.

## After / evidence
Implemented: 44×44 search-clear control, minimum 44px filter and reset controls, accessible selected states and descriptive labels for directory filters and cards, visible reset for sort-only changes, alert semantics on error, 112px minimum card height and improved narrow-screen location typography. Preserved OASIS palette, RTL layout, 820px responsive max-width, bottom inset and existing navigation/data queries.\n\nRegression coverage: `tests/directoryDesign.test.cjs` (selection semantics, reset, touch targets, responsive invariants). GitHub Actions TypeScript/Web/platform checks and required review are release gates; record results in PR before merge. No physical-device visual testing in this run.

## Next section
Business detail screen (`app/business.tsx`): media, CTA hierarchy, responsive details and loading states.
