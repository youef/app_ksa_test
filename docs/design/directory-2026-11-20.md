# Directory UI design pass — 2026-11-20

## Scope and design plan (before implementation)
- Focus exclusively on `app/directory.tsx`; preserve the existing OASIS palette, typography, cards, AppHeader, bottom navigation inset and responsive 820px content width.
- Make searching more predictable on mobile: dismiss the keyboard on Search and on scroll.
- Clarify paginated result counts; keep reset available for any modified filter including sorting.
- Improve right-to-left card density and metadata wrapping on narrow iPhone/Android widths.
- Make the directory scope, cards, errors and business management action understandable to assistive technology.
- Keep load/error/empty/skeleton states consistent; do not alter database, business rules, other screens or unrelated systems.

## Before → after
- Search keyboard stayed visible on submission/drag → keyboard dismisses on both.
- Result count implied all results were loaded → count explicitly identifies partial pages.
- Sort-only filter change had no reset → reset appears for sort changes too.
- Error retry after partial pagination could append the wrong page → retry starts with a fresh page.
- Management action had no accessible role/name → explicit button role and action label.
- Card accessibility only read the name → also announces entry type and verification.
- Card metadata could crowd compact screens → wrapping and consistent minimum card height.

## Validation
- Code review: scoped to one route, no navigation/database contract changes.
- TypeScript: pending CI/local execution.
- Expo web export: pending CI/local execution.
- Existing automated tests: pending CI/local execution.
- Device manual QA: pending iPhone, Android, iPad and web review.
- Do not merge or deploy until required checks and review pass.

## Next section
- `app/search.tsx`: search result hierarchy, filters, empty/error states and small-screen layout.
