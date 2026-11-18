# Profile activity cards — UI plan (2026-11-08)

## Scope
Only `app/user.tsx` profile activity section (not the shared profile header or profile business logic).

## Before
- Horizontal category strip lacks a tab-list accessibility role and explicit label/count announcements.
- Section heading does not consistently align RTL; the category scroller may not expose a readable context.
- Empty/loading/error states use uneven text alignment; retry is unlabeled for assistive tech.
- Review author rows have compact touch targets; review body has no explicit RTL alignment.

## Design decisions
1. Keep existing OASIS colors and category styles; expose a named tab list and selected tab with count.
2. Make activity section titles and descriptions right-aligned, and add semantic headings for screen readers.
3. Improve touch sizes for review author and market navigation without changing destinations.
4. Add polite loading/error announcements and a descriptive retry label.
5. Keep card grid breakpoints, safe-area handling, tab data loading, and privacy logic untouched.

## Acceptance
TypeScript and available platform bundle CI must pass; no database/API changes. Review before merge. Record after-state and next page in PR.

## After (implemented)
- Category scroll is labelled as a tab list; each tab announces its category, count and selection state.
- Activity section title is a semantic heading; header wraps instead of clipping on narrow devices.
- Market link has a 44-point minimum target; review author navigation announces the author.
- Loading and error states announce changes politely; retry announces its purpose; empty heading centers.
- Existing activity cards, routing, data fetching and privacy behavior remain unchanged.

## Verification
Added `tests/profileActivityDesign.test.cjs` for source-level regression coverage. GitHub TypeScript, platform export and available web checks are release gates; results tracked in PR.

## Next section
Profile customization entry and featured-content management controls (avoid reworking the shared profile header).
