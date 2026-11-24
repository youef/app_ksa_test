# Market business details — recoverable partial-data errors

Date: 2026-11-24
Scope: `components/market/BusinessDetailsSheet.tsx` only, plus one focused Node regression test and this delivery note.

## Plan before implementation
1. Inspect the default-branch market sheet and current open PRs.
2. Avoid `app/market.tsx`, product cards and promotion loading: active or recently merged marketplace work already covers those surfaces.
3. Keep the change limited to one observed UX defect: section-level query failures can tell the user to retry without presenting a retry action when the main business profile query itself succeeded.
4. Add a consistent, labelled, 44-point retry action for hours, offers/services and the details warning. Reuse the existing retry state and read flow; do not alter queries, permissions, routes, business data or persistence.
5. Add focused regression coverage and run the repository CI checks. Keep the PR in Draft; no merge or deployment.

## Current-state review
- Default branch: `main` at `ed409c0cda76a15a5704e09e3de70750aa5d336f`.
- Relevant open PRs reviewed: #84 and #56 touch `app/market.tsx` and commerce flows; #180 is service detail; #123 is favorites; #183 is profile. None of their changed-file lists include `components/market/BusinessDetailsSheet.tsx`.
- The prior promotions recovery PR #178 is already merged and touches `MarketPromotions.tsx`; this change deliberately does not repeat it.
- Existing sheet uses `useSafeAreaInsets`, a 44-point close/inline controls and a shared retry counter that reloads its four public read queries.

## Before
- If hours or offer queries failed while the business profile query succeeded, the sheet displayed a text-only failure message.
- The text suggested retrying, but no action was rendered in those partial-error states.
- The details warning had an icon-only retry control without an accessible label.

## After
- Hours and offers/services partial failures each show a visible Arabic retry action.
- The details warning uses the same consistent retry action.
- Controls expose button role, a meaningful accessibility label and busy/disabled state.
- Touch target is at least 44 points high and the label remains visible.
- Retry reuses the existing sheet reload state; all data queries, business privacy rules, navigation, RTL layout and Safe Area handling remain unchanged.

## Tests
- Added `tests/businessDetailsPartialRetry.test.cjs` with six source-level regression checks.
- GitHub Marketplace integration workflow ran `node --test --test-concurrency=2 tests/*.test.cjs` on this PR and completed successfully (run #45333016890).
- The PR-triggered `Inquiry discussion checks` workflow includes `npm run typecheck` and Expo Web, Android and iOS JS bundle exports (run #45333016859); these checks were still running at the time this note was prepared. Results are tracked in the PR, not assumed.
- The connector environment did not provide a local checkout, so commands were executed by GitHub Actions rather than locally.
- A Vercel preview build started automatically for the branch and was canceled before it became ready to honor the no-deploy instruction; no production deployment was started.
- Manual device/screen-reader verification remains pending.

## Next rotation
Next run returns to the profile screen, after re-checking open PRs for overlap.
