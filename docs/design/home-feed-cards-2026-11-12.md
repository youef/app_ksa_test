# Home feed cards UX — 2026-11-12

## Plan (before implementation)
Scope: shared `TwitterInquiryCard` feed card, exclusively its compact home-feed presentation. Preserve Oasis palette and existing data/actions. Improve compact card interaction discoverability, accessibility semantics, RTL and touch sizes without backend changes.

1. Give the author and overflow actions at least 44 logical pixels of touch height/width.
2. Label bookmark/share/view interactions and expose selected bookmark state to assistive technology.
3. Make compact content title navigable and describe its destination with the post title.
4. Keep existing responsive flex wrapping, platform layout, and card state handling unchanged; inspect web and native behavior in CI.

## Before
Author-name and overflow actions lack consistent explicit accessible labels; bookmark and share actions have icon-only affordances; selected bookmark is not announced. Compact post detail target has a generic label.

## Validation gates
Run TypeScript, Web export and available tests; manual iPhone, Android, iPad and web review for Safe Area, RTL and large text. Keep PR draft, no merge/deploy before checks and approval.

## After implementation
- Author avatar/name and overflow actions have 44px minimum target sizes.
- Compact post detail action now includes its title in the screen-reader label.
- Bookmark and share have accessible names; bookmark exposes selected state.
- View count has an explicit accessibility label.
- Existing Oasis colors, RTL flex structure, loading/error handling, Safe Area and navigation were not modified.

## Results and outstanding checks
Source changes committed. TypeScript, Web export and test suite not yet verified; device screenshots/review pending. Do not merge or deploy until all required checks pass.

## Next section
Home feed empty state and filtered-no-results messaging (separate design batch).
