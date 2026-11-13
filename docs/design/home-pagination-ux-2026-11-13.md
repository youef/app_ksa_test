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
Pending implementation and validation. Record actual results below, not assumed results.

## Next section
Home feed refresh feedback and scroll-to-top affordance.
