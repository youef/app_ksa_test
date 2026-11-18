# Market favorite interaction — 2026-11-18

## Prior state and conflict review
Open PR #134 already changes the market loading skeleton and account loading state. This iteration avoids those loading branches and modifies only the market favorite controls. Other open design PRs were checked before branching from main.

## Detailed plan
1. Scope: market product/service and store favorite buttons only.
2. Keep existing Supabase favorite persistence and optimistic rollback unchanged.
3. Add explicit accessible save/remove labels and selected state.
4. Add subtle pressed opacity and scale, with no scale when OS reduced motion is enabled.
5. Keep RTL, existing card layout, and button hitSlop unchanged.
6. Avoid broad animation framework or unrelated edits.

## Before → after
- Favorite icon lacked accessible button label/selection state → labeled save/remove control with selected state.
- No explicit pressed feedback → opacity and 0.93 scale while pressed, respecting reduced motion.
- Persistence logic unchanged; failed save still restores previous state.

## Verification
Code reviewed at source level; TypeScript, web export, tests and device visual QA were not run in this connector environment. This change must not merge or deploy before checks/review succeed.

## Next iteration
Profile screen: inspect profile header action buttons for accessibility labels and reduced-motion press feedback; avoid changes overlapping open PR #134.
