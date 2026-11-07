# Favorites UI refinement — 2026-11-07

## Scope and design plan (recorded before implementation)
Target: `app/favorites.tsx` only. The previous completed UI batch covered `/lives`, `/live/create` and `/live/[id]`; this batch deliberately selects a different screen.

1. **Visual hierarchy:** align the hero and action accents with the existing OASIS design tokens, preserve readable contrast, and limit the content width on iPad and desktop while retaining fluid small-phone layout.
2. **RTL and touch:** keep Arabic search/filter order; provide minimum 44px touch targets, selected-state announcements and contextual labels for saved items.
3. **Feedback:** distinguish initial loading from in-place refresh, avoid showing stale content as a hard failure, and add a clear reset when a search/filter has no matches.
4. **Navigation:** correct the empty-state discovery action to navigate to the actual questions list, not a detail page without an ID; disable misleading detail actions for missing target routes.
5. **Verification:** add static regression tests for accessibility and empty-state routes; require repository TypeScript, web export and existing checks to pass before considering merge. No unrelated changes or permission changes.

## Baseline (before)
Purple-only hero and controls differ from the shared green OASIS palette; saved-item buttons use generic labels; refresh icon gives no visible progress; search/filter empty results offer only explanatory text; the empty-state questions link points at `/question` without an ID; list has no tablet max-width.

## Target (after)
Unified OASIS colors, clearer actions and accessibility labels, responsive centered content, refresh feedback, useful reset CTA, and correct questions navigation. Actual screenshots and device testing remain separate validation requirements; static checks do not substitute for visual QA.

## Next section
`/notifications` — notification list hierarchy, read/unread indicators, and accessible actions.

## Implementation outcome (after)
- `app/favorites.tsx`: shared OASIS green accents replace the previously inconsistent purple in primary controls, hero and feedback.
- Max-width 880px centered content keeps the same bottom-navigation inset on phones, tablets and desktop.
- Filters expose selection state and count to assistive technology; item actions announce item names; refresh shows progress and disables repeated taps.
- Empty search results now have a reset button, and the browse-questions action uses `/questions`.
- `tests/favoritesDesign.test.cjs`: static regression assertions added; GitHub CI is the execution gate. No screenshot-based before/after proof has been collected.
- PR #96 remains draft pending checks and review. No merge or production deployment is authorized by this batch until gates pass.
