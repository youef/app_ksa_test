# Native map screen UX plan — 2026-11-20

## Scope
Improve the native iOS/Android map screen in `app/map.tsx` only. The web implementation (`app/map.web.tsx`) is intentionally untouched because open map PRs #34 and #43 already modify it. No map-data, privacy, navigation, or backend behavior changes are intended.

## Design plan (written before implementation)
1. **Hierarchy and responsive layout**
   - Keep the existing AppHeader and full-bleed map as the visual anchor.
   - Refine the floating search/filter surface into a calmer Oasis card with a clear search field, consistent chip rhythm, and a compact count row.
   - Center floating controls and result/detail sheets with a sensible maximum width on iPad while preserving full-width gutters on phones.
   - Derive the results sheet height from the available viewport instead of a fixed 240px cap.
2. **Safe areas**
   - Use safe-area insets for the bottom results sheet, add menu, selected-place/selected-pin panels, and back control so they clear iPhone home indicators and Android gesture/navigation areas.
   - Keep spacing between stacked overlays to prevent the selected detail panel from colliding with the nearby-places sheet.
3. **Touch and accessibility**
   - Raise category/filter chips and action rows to at least 44px high.
   - Expose active filters with selected accessibility state and provide descriptive labels for search, location, and dismiss controls.
   - Preserve RTL ordering and readable contrast for selected/unselected states.
4. **Loading, empty, and error recovery**
   - Distinguish map-pin loading, empty, and failure states.
   - Replace the misleading generic nearby-place empty message with context-aware copy for city selection, no results, and failed lookup.
   - Provide an explicit retry action for failed pin/place loading and announce inline errors accessibly.
5. **Interaction polish**
   - Submit the search from the native keyboard as well as the search control.
   - Keep existing filter, marker selection, navigation, and data/privacy behavior intact.
   - Use restrained elevation, border, and radius tokens; avoid introducing heavy animation or new dependencies.

## Before / after targets
- Fixed overlay offsets and 240px sheet cap → safe-area-aware offsets and viewport-derived sheet sizing.
- 24–36px filter/action controls → 44px minimum touch targets.
- Unused pin loading state and console-only failure → visible loading/error/empty feedback with retry.
- Generic nearby-place empty copy → clear city / no-results / retry guidance.
- Phone-wide overlay panels on all widths → centered, capped panels on larger screens.

## Validation
- TypeScript: `npm run typecheck`
- Web export: `npm run export:web` (web route remains unchanged; checks platform resolution)
- Focused UI regression: `node --test tests/mapNativeLayout.test.cjs`
- Existing available tests: `node --test tests/*.test.cjs tests/*.test.mjs`
- Manual iPhone / Android / iPad safe-area and touch review remains a device QA item.

## Release guard
Keep the PR as draft until automated checks pass and a maintainer review is recorded. Do not merge or deploy production from this batch.
