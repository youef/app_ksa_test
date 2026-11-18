# Favorites UI refinement — 2026-11-17

## Scope
Only `app/favorites.tsx`. No data schema, security, or unrelated feature changes.

## Design plan
1. Keep the shared AppHeader, Oasis surfaces, brand tokens, and existing RTL layout.
2. Constrain content width on large screens and use two-column cards from 760px.
3. Improve search discoverability, add a clear-search affordance and reset for empty filtered results.
4. Raise touch targets for refresh, remove, detail, and filter actions to approximately 44px.
5. Add accessible labels and selected state for category filters.
6. Preserve loading, signed-out, error, and empty states and bottom navigation inset.

## Before → After
- Unbounded single-column list on tablets/web → centered max-width layout and responsive two-column cards.
- 31–34px refresh/delete controls → 44px touch controls.
- Small search and card text → larger readable sizes.
- No direct clear-search/reset action → clear-search and clear-filter controls.
- Generic card accessibility labels → labels containing item titles and filter selection state.

## Verification
- Source-level review: completed; modifications limited to favorites screen.
- TypeScript: not run in connector environment.
- Web export: not run in connector environment.
- Automated tests: not run in connector environment.
- Device-level visual review: pending (iPhone, Android, iPad, web).

Run `npm ci && npm run typecheck && npm run export:web && node --test tests/*.test.mjs` in CI or a local checkout. Do not merge or deploy until checks and review succeed.

## Next section
Review the Saved/Bookmarks entry points and navigation consistency only after this PR is validated.
