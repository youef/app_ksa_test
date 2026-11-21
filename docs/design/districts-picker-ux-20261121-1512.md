# District picker UX plan — 2026-11-21

## Selected screen
`app/districts.tsx` — district selection for the chosen city. This is the next step after the cities picker, and no currently open UI PR changes this file.

## Baseline (before)
- Search uses raw `name.includes(search.trim())`, so Arabic variants (hamza/diacritics/taa marbuta/yaa) do not match consistently.
- No visible result count, no clear-search control, and no distinct no-results recovery.
- Cards use 14px radius and 14px padding; the pin surface is 38px. The row has no explicit minimum height.
- The list ends with a fixed 100px spacer despite already using the shared bottom-nav inset.
- Selection failure silently routes to `/home`, losing the user's place in the picker.

## Design approach
1. Preserve the shared AppHeader, OASIS colors, OasisPressable/TextInput primitives, RTL, route params, city/district data, GPS city lock, and bottom navigation behavior.
2. Normalize both district labels and the query with the existing `normalizeSaudiLocationName` helper (no new normalization rules or duplicated helper).
3. Give the search control an accessible label, 44px clear button, and clearable query state.
4. Add a localized, live result count below search; render a concise, centered empty-state card with a clear-search recovery action when no district matches (also cover cities with zero districts).
5. Refine district cards to a 76px minimum row, 18px radius, a 44px icon surface, token-based border, and clearer name/city hierarchy. Keep the whole card as the touch target and announce the district/city via accessibility label.
6. Cap content width on wide web/tablet layouts, keep natural scroll, remove the arbitrary 100px trailing spacer, and rely on existing `bottomNavInset` padding. Avoid fixed header/bottom offsets.
7. Replace the silent selection-error redirect with a localized retry/cancel alert so the user remains in context. This only changes error recovery for district selection; no persistence semantics or access/privacy rules change.

## Acceptance criteria
- Arabic search matches normalized variants and still supports exact/partial text.
- Empty search shows all districts; non-empty search displays count and clear action.
- No-results/empty-city state is understandable and recoverable.
- Cards are comfortable to tap (>=44px), RTL, responsive, and screen-reader labeled.
- Header, bottom navigation inset, GPS lock, route parameters, and city/district data remain unchanged.
- No changes outside the districts picker, its focused UI test, CI validation workflow, and this design record.

## Before/after summary
- Raw string search → normalized Saudi Arabic search.
- No feedback/recovery → accessible count, clear action, no-results recovery.
- 38px pin surface / 14px card radius / no row minimum → 44px pin surface / 18px radius / 76px row minimum.
- Arbitrary 100px spacer → natural scroll with existing bottom-nav inset.
- Silent redirect on selection failure → retry/cancel message, remain in picker.

## Verification results
- **TypeScript:** `npm run typecheck` passed in the focused PR workflow.
- **Web:** `npm run export:web` passed in the focused PR workflow.
- **Focused UI contract tests:** passed (5 test cases).
- **Repository test suite:** `node --test --test-concurrency=2 tests/*.test.cjs` passed in `payment-safety` workflow.
- Local checkout was unavailable (DNS/network resolution for `github.com` failed), so local commands were not run.
- Android/iOS JS bundle jobs remain in progress; this is additional validation, not device QA.
- iPhone/Android/iPad visual review and VoiceOver/TalkBack QA have not been performed.

## Next screen
Review the neighbourhood onboarding/confirmation experience after this PR is reviewed; do not open a parallel PR on this same screen.
