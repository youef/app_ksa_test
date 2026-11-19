# Profile header touch targets — 2026-11-19

## Scope and plan
- Scope: shared profile header only, used by the public profile and account editor.
- Inspect existing header button sizes and prior market/profile skeleton and favorites PRs; avoid changes to loading, data or navigation logic.
- Increase compact controls to a minimum 44 × 44 pt touch area while preserving RTL icon/text order, existing palette and compact layout.
- Prevent actions with no callback from appearing interactive to assistive technology.

## Before → after
- Cover edit action: 32 pt minimum height → 44 pt.
- Standard actions: 39 × 38 pt minimum → 44 × 44 pt.
- Icon-only controls: 39 pt width → 44 pt.
- Stats touch row: 51 pt minimum → 56 pt.
- Shared action factory and own-profile design/settings controls now disable absent handlers.

## Validation
- Source-level verification: exact scoped replacements checked while editing.
- TypeScript, Expo Web export, automated tests, and iPhone/Android/iPad visual tests **not run** in the GitHub connector environment. CI status must be checked before review.
- Keep draft; do not merge/deploy before successful checks and review.

## Next
Market: review listing card tap/like hit targets and text truncation at narrow widths; choose one focused improvement after checking outstanding PRs.
