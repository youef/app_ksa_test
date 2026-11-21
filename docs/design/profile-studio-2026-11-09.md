# Profile design studio — UI plan (2026-11-09)

## Scope
Only `components/profile/ProfileDesignStudio.tsx` and its entry point. No account, permissions, backend, or unrelated changes.

## Before
- Cover buttons have 40px touch targets; color swatches 38px and compact controls can be difficult to tap.
- Featured work tabs and rows lack explicit selection/checked semantics; the save icon has no accessible label.
- Empty state does not tell users what category was selected; pinned remove actions have no descriptive label.
- Long names can stretch preview; the entry card uses an extra decorative pin that competes with its primary action.

## Design plan
1. Keep the existing Oasis palette and RTL reading order, improve typography and card hierarchy without introducing a new theme.
2. Enforce at least 44px targets on cover, swatches, save, tabs, and featured rows; keep a compact layout on phones and responsive preview/control columns on tablets/web.
3. Add explicit selected/checked/disabled states and Arabic screen-reader labels for visual-only actions.
4. Clarify empty state and selection affordances; retain existing callbacks and instant preview behavior.
5. Test via CI typecheck and web bundle; do not merge until checks and review pass.

## Acceptance / after evidence
- Diff: 44px+ controls, accessible cover and featured management, selected tabs, resilient preview name, and simpler entry card.
- Automated source regression assertions in `tests/profileStudioDesign.test.cjs`.
- Review GitHub CI check conclusions and PR review before merging. No deployment from feature branch.

## Next section
Profile account settings grouping and visual hierarchy, without overlapping this studio.
