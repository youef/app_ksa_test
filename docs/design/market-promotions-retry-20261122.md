# Market Promotions — non-blocking failure recovery / 2026-11-22

## Scope and baseline (before implementation)
Target only `components/market/MarketPromotions.tsx` and its isolated regression test. This component is rendered in `app/market.tsx`, but that parent screen is intentionally not edited because open PRs #56, #84 and #169 already change it. Open PR #84 also spans the marketplace commerce flow; PR #169 is specifically pending-favorite behavior. Profile PR #175 is unrelated.

Observed baseline:
- The component calls `hayna_marketplace_promotions` and refreshes every 60 seconds.
- RPC failures are silently ignored (`if (!response.error) setRows(...)`); the widget returns `null` when no rows exist, so a first-load failure looks identical to “no promotions”.
- There is no in-component retry control or accessible busy state.
- Existing successful promotions are retained during a failed refresh, but the failure is not surfaced.

## Plan
1. Keep the query, city/district scope, 60-second refresh, expiration filtering, destination routing, and promotion-card presentation.
2. Add a compact, theme-aware error strip/card only when a fetch fails; distinguish failure from the no-promotion state without forcing a banner or reserving empty space on successful/no-data loads.
3. Provide an accessible 44px retry action with disabled/busy state and spinner while a manual retry is in progress.
4. Guard requests with a monotonically increasing ticket so stale results after a location change or overlapping refresh cannot overwrite the current state.
5. Add focused source-contract tests for failure recovery, retry accessibility, stale-request protection, and retained polling.

## Before / after
- Before: network failure is silently treated as no promotions; no recovery action.
- After: a small retry surface explains the failure; existing promotions remain visible if refresh fails; retry is keyboard/screen-reader accessible and reports busy while working.
- No new animation, backend, data, privacy, route, or unrelated screen changes.

## Acceptance / checks
- Focused Node test: `tests/marketPromotionsRecovery.test.cjs`.
- GitHub PR checks: TypeScript, web export and repository tests where configured.
- Manual RTL, reduced-motion, screen reader, and real-device QA still required.
- Draft PR only. Do not merge or publish production before successful checks and human review.

## Next batch
Profile: inspect AccountCenter’s responsive and accessibility presentation, avoid the open profile PRs (#99/#100/#175), and choose a single non-overlapping UX fix.
