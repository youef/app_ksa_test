# Market favorite interaction — 2026-11-20

## Scope and plan (before implementation)
Only `app/market.tsx`: product/service and store favorite buttons. Existing market PR #84 concerns a broader commerce redesign; avoid changing its flows or backend. Profile PR #100 is unrelated.

1. Inspect existing optimistic save behavior and accessibility states.
2. Prevent overlapping writes for the same favorite while preserving independent saves.
3. Show pending state and a clear Arabic accessibility label; preserve reduced-motion behavior and rollback on errors.
4. Verify TypeScript, web export, tests and device QA before any merge.

## Before
Rapid taps could issue overlapping insert/delete requests for one item; the button did not expose a busy state. A delayed response could override the last intended state.

## Expected after
One in-flight write per favorite, visible spinner, disabled button, `busy` accessibility state, optimistic heart and existing rollback. Other cards remain usable.

## Verification
Pending: `npm run typecheck`, `npm run export:web`, `node --test tests/*.test.mjs`, manual RTL/iOS/Android/web and screen reader checks. Environment's GitHub DNS is unavailable for local checkout. Keep draft and do not merge or deploy until all gates pass.

## Next batch
Profile: review `components/account/AccountCenter` for one concrete accessibility or responsive layout issue, avoiding PR #100 changes.
