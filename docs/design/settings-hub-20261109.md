# Settings hub — design plan (2026-11-09)

## Scope
Only the settings category hub inside `components/account/AccountCenter.tsx`. The existing `/settings` route redirects to the settings tab; preserve it. Do not alter privacy, account, or notification persistence.

## Baseline (before)
Three grouped section cards already exist. The nine section rows have 65px minimum height, 36px icons, descriptions forcibly truncated to one line, no explicit screen-reader hint describing their destination, and the settings detail return action is only 40px tall. On narrow devices, the truncated descriptions hide important distinctions between privacy and security.

## Detailed design
1. Preserve the three groups and order, existing OASIS palette, and RTL right-aligned content.
2. Increase icon tiles to 42px and row minimum touch target to 72px; keep subtle separators and a right-to-left directional chevron.
3. Allow descriptions to wrap to two lines, with a readable line height; titles remain visually stronger.
4. Make the section row accessible as a single navigation button, including its description as an accessibility hint; do not expose decorative icons as separate controls.
5. Increase the detail-to-hub return control to 44px, with clear accessible navigation.
6. Preserve the existing ScrollView, AppHeader, bottom inset, loading and error behavior; avoid extra animations and dependencies.

## Verification / acceptance
TypeScript check, web/platform bundle jobs, existing tests; ensure no business logic or RLS changes. Before/after documented here after implementation. Leave the PR unmerged until checks and required review complete.

## Next section
Profile account verification overview / identity tab, excluding the previously refined profile header and content cards.

## Implemented (after)
- Nine grouped settings rows retain the existing OASIS design tokens and RTL navigation.
- Minimum row target: 65 → 72px; icon tile: 36 → 42px; title: 12.5 → 14px; subtitle: 11 → 12px with 18px line height.
- Subtitle truncation: 1 → 2 lines; details-return control: 40 → 44px.
- Added per-row accessibility hints and excluded decorative icons from the accessibility tree.
- Added `tests/settingsHubDesign.test.cjs` covering RTL grouping, tap sizes, readable subtitles, and return navigation.

## Verification status
Awaiting GitHub Actions TypeScript, web bundle, platform bundle, and available tests. Physical iPhone/Android/iPad testing has not been performed; do not claim visual-device verification. PR remains draft and unmerged pending checks and required review.
