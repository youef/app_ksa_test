# Service Detail UX — Implementation Results (2026-11-22)

## Scope
UI-only refinement for `app/service.tsx`. No database, data payload, permissions, contact routes, editing limits, moderation, or service behavior changes.

## Implemented
- Header share/report controls enlarged to 44×44pt with theme-aware surface.
- Safe-area bottom inset used for sticky actions and scroll clearance; gallery width is clamped for narrow screens.
- Gallery image, image counter, lightbox and related offer cards receive accessible labels; decorative pagination dots are hidden from accessibility.
- Card surfaces/radii and spacing refined; gallery depth is subtle; title/price row can wrap.
- Contact actions have explicit 48pt minimums; seller/owner actions have 44pt minimums and owner controls can wrap.
- Related offers are 160pt wide with 112pt media.
- Fixed light-only colors in this screen now use OASIS theme tokens for dark/light compatibility.
- Edit modal is bounded to 560pt on larger displays, max-height 88%, horizontally inset, scrollable form body, accessible field labels and 48pt minimum controls.

## Before / after
| Area | Before | After |
|---|---|---|
| Share/report | 34pt controls | 44pt controls |
| Gallery/info/section | tighter mixed surfaces | 20/18pt gallery/info radius and 16pt section padding |
| Light-only colors | fixed greens, grays and warning hues | theme tokens |
| Contact controls | padding-based | 48pt minimum |
| Owner controls | compact buttons | 44pt minimum, wrapping row |
| Related cards | 145pt / 95pt media | 160pt / 112pt media |
| Edit modal | 90% height without inner scroll | 88% max, 560pt width cap, safe-area and scrollable fields |

## Regression checks
- Added `tests/serviceDetailDesign.test.cjs` (7 focused static layout/accessibility contract tests) and a scoped CI step to run it in `inquiry-discussion-checks.yml`.
- Not executed locally: the repository is not checked out in the execution container. GitHub Actions will be the authoritative TypeScript, Web export and focused test result for this branch.
- Manual iPhone, Android, iPad, web, keyboard, VoiceOver and TalkBack checks remain pending.

Draft only; do not merge or deploy production until the PR checks and required review pass.

## Next screen
`app/new-service.tsx` — service creation form. No dedicated design PR for that screen was found in the recent PR search.
