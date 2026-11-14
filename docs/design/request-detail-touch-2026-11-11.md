# Request detail UX — 2026-11-11

## Plan (before implementation)
Scope: `app/request.tsx`, specifically offer quick replies and request owner edit controls. No request API, matching logic, or authorization changes.

1. Preserve Oasis palette, right-aligned Arabic labels, and existing RTL row order.
2. Increase quick-reply chip and edit/delete control touch areas to at least 44 logical pixels; keep wrapping and readable multiline labels on narrow phones.
3. Give modal actions consistent minimum touch height and allow labels to shrink without clipping; preserve Safe Area and keyboard handling already present in the screen.
4. Verify TS, web export and available tests in CI; do not merge or deploy until checks and review pass.

## Baseline
Quick reply chips use vertical padding 6 without a minimum touch height; owner edit/delete buttons use padding 10 without a minimum height; modal action buttons use vertical padding 12 without a minimum height.

## After / validation
Implemented five minimum-height / centering style adjustments in `app/request.tsx`: quick reply chips (44), edit/delete actions (44 each), and modal save/cancel actions (44 each). No business logic or data changes. CI and device review not yet verified. Next section: request feed filters and status cards.
