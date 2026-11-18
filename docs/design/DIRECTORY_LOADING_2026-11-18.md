# Directory design iteration — 2026-11-18

## Design plan
Scope only `app/directory.tsx`, the city directory.
1. Preserve existing header, location scope, search, category segments, RTL, safe bottom inset and shared Oasis palette.
2. Replace the generic initial spinner with content-shaped cards that reflect directory result geometry.
3. Keep loading feedback accessible without motion or flicker; avoid additional dependencies.
4. Preserve error, empty results, pagination, filters and refresh behavior.
5. Verify on iPhone, Android, iPad and web before merging.

## Before / after
Before: centered spinner and loading text with a large layout shift when results arrive.
After: four right-to-left placeholder cards with image and title/description bars sized to match real cards, plus accessible loading description.

## Scope and validation
Changed: directory screen only. No database, authentication or unrelated project changes.
GitHub source update: committed.
TypeScript: not run (GitHub connector does not provide a checkout/runtime).
Web export: not run.
Automated tests: not run.
Visual device review: pending.
Merge/deployment: blocked until checks and review succeed.

## Next page
Notifications — assess category filters, unread emphasis and loading/error states, avoiding sections already covered by other open PRs.
