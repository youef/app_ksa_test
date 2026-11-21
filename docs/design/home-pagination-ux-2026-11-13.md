# Home feed pagination UX — 2026-11-13

## Scope and design plan (before implementation)
Only the bottom-of-feed pagination area in `app/home.tsx`. Keep existing fetch and filtering logic, Oasis theme, RTL and the shared bottom navigation unchanged.

1. Replace the bare spinner with an accessible, descriptive progress row that reserves stable vertical space and indicates that more posts are being loaded.
2. Keep a manual fallback button, with at least a 48px touch target, while preserving automatic infinite scroll.
3. When no additional results are available, display a quiet end-of-feed label (only if posts exist), rather than leaving the page abruptly.
4. Use theme tokens, center within the existing responsive feed column, and avoid decorative animation that competes with scrolling.
5. Verify TypeScript, web build and available tests; do not merge or deploy until checks and review pass.

## Before
The footer displayed only a spinner while loading; the action had no explicit loading state for screen readers, and the end of results had no visual closure.

## After / validation
Implemented in `app/home.tsx`: loading footer now includes a spinner plus Arabic status text and busy/disabled accessibility state; manual fallback remains 48px high; a quiet end-of-feed message appears when visible posts exist and there are no more pages. Uses current theme colors and existing responsive feed width. No data-fetch logic was changed.\n\nValidation: source diff inspected; local TypeScript, Web build, and automated tests could not be executed because this runner cannot resolve github.com for a local checkout. CI status and human review must be verified on the PR before merging.

## Next section
Home feed refresh feedback and scroll-to-top affordance.
