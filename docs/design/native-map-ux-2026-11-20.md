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
- Web export and metadata validation: `npm run build` (includes Expo Web export)
- Focused UI regression: `node --test tests/mapNativeLayout.test.cjs`
- Unrelated game, television, and security-maintenance test suites are intentionally not part of this UI-only batch.
- Manual iPhone / Android / iPad safe-area and touch review remains a device QA item.

## Release guard
Keep the PR as draft until automated checks pass and a maintainer review is recorded. Do not merge or deploy production from this batch.

## Implemented
- The native map overlay now starts below the actual AppHeader/safe-area height; the map search submits from the keyboard.
- Phone/tablet overlays and result/detail surfaces use safe-area-aware gutters, a viewport-derived results height, and centered width caps at tablet breakpoints.
- The results list is hidden while a marker/place detail panel is open, preventing stacked sheets from obscuring each other on compact screens.
- Category/sort filters expose selected state; search, place cards, retry controls, location, and back actions have clearer accessibility labels and larger touch areas.
- Map-pin loading/failure/empty states and nearby-place loading/failure/contextual empty states are visible with retry actions.
- Added `tests/mapNativeLayout.test.cjs` and a pull-request workflow that runs TypeScript, the Expo Web build, and the focused map regression.

## Actual before / after
- Overlay top offset was a fixed 42px and could collide with the header on devices with different status-bar insets → it now follows `useAppHeaderHeight()` plus a consistent gap.
- Results sheet and back/menu/detail controls used fixed bottom offsets → they now account for safe-area insets.
- Results sheet used a fixed 240px maximum on every device → it now scales to the viewport and its internal scroll area scales with it.
- Place details could overlap the nearby list → the list yields while a selected detail panel is open.
- Search/filter controls had no native keyboard submit and several filters lacked selected semantics → keyboard submit and accessibility states/labels are now explicit.
- Failed map-pin loading was only logged and the empty places message implied location permission even when a city was selected → explicit retry/error and context-aware empty states are shown.

## Scope and review notes
- Changed files: `app/map.tsx`, `tests/mapNativeLayout.test.cjs`, `.github/workflows/native-map-ux.yml`, and this design note.
- `app/map.web.tsx` and `lib/mapPins.ts` were deliberately left untouched to avoid overlap with open map PRs #34 and #43.
- This batch changes presentation and UI recovery only; it does not alter map coordinates, pin filtering rules, privacy behavior, routing destinations, or backend queries.

## Validation status
- Automated TypeScript, Expo Web build, and focused map regression are wired to run on this PR; results must be read from the PR checks before merge.
- iPhone/Android/iPad visual and assistive-technology review still requires physical/simulator QA.
- Keep this PR in draft until all automated checks pass and a maintainer review is recorded.
