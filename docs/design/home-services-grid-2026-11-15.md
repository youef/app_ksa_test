# Home services shortcuts — 2026-11-15

## Plan (before implementation)
Scope only `components/home/ServicesGrid.tsx`. Current shortcuts use a fixed six-column width based on device width, despite showing three to five items; 36px icons and 11px single-line labels create tiny targets and truncation. Replace with a responsive, centered RTL grid: two columns on compact phones, three on regular phones, up to five on tablets/web. Use 48px icon surfaces, >=48px touch height, flexible labels, Oasis theme colors and descriptive screen-reader hints. Keep navigation/auth/guest visibility unchanged. Test TypeScript, web and available suites before merging; no automatic publication.

## Before
Fixed six-column item widths, tiny icons and single-line truncation on narrow screens.

## Intended after
Responsive RTL shortcut tiles with readable multiline labels, predictable touch areas and consistent visual rhythm.

## Verification
Pending implementation and checks.

## Next section
Home header visual hierarchy and safe-area spacing.
