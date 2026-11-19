# New listing experience – design & publish plan (2026-11-19)

## Scope
Only `app/new-listing.tsx`. Preserve product location verification, seller capability checks, profanity policy, image storage, and existing `marketplace_items` schema. Services remain routed to `/new-service`; no database migrations.

## Findings before
1. Product picker copy advertised personal selling while capability RPC may restrict publication to approved accounts; unavailable actions communicate with native-only alerts on web.
2. Preview prints `null ر.س` for donation/loan listings.
3. Image removal touch target is 32×32 and lacks replacement action after a photo is chosen.
4. Publication does not require the preview step; edited data can remain in an already-open preview.
5. Account setup errors surface in a product editor with an empty profile rather than a focused retry state.
6. Progress and completeness are unclear; review and error controls are hard to scan on small phones.
7. Save protection only starts after asynchronous content moderation; repeated presses can start overlapping checks.

## Proposed UX/UI
- Responsive RTL creation header with a dynamic readiness summary (photo/details/location/verification).
- Accessible 44-point controls for chips/photo actions and responsive two-field layout.
- Cover photo replace/remove; live character counts and accessible selected states.
- Accurate free/negotiated/fixed price preview and a confirmed preview gate before publishing.
- Retryable setup-error state with explicit account actions, and web-visible inline errors.
- Clear publishing progress and an actionable success screen, linked to the new item and own listings.
- Respect safe-area at the bottom; avoid adding continuous animation.

## Wiring and acceptance
- Keep Supabase RPC `hayna_my_account_capabilities`, auth, `hayna_ensure_my_business`, position reread + `confirmProductPosition`, and `marketplace_items` columns intact.
- Do not label a successful insert as approved by moderation. Ensure a failed upload/insert cannot report success.
- No general security/TV/game work.
- Attempt `npm run typecheck`, `npm run export:web` and available tests. Obtain GitHub checks and only merge after checks allow it. If checks unavailable, retain PR and report truthfully.

## Before → after (implemented on branch)
- Before: a spinner with no recovery path if account setup fails. After: content skeleton, clear failure details and retry/account actions.
- Before: card promised personal selling despite a restricted account; web-only alerts could be invisible. After: capability-aware copy and an inline actionable notice.
- Before: photo delete was 32×32 and replacing required deletion first. After: 44×44 delete and one-step replace; image-picker errors appear inline.
- Before: previews could show `null ر.س` on non-sale listings; no required review before publishing. After: accurate free/loan/negotiated/fixed labels, a preview gate, and a return-to-edit control. Edited details invalidate the preview.
- Before: business RPC ran without linking the returned UUID to the item. After: `business_id` from `hayna_ensure_my_business` is saved on the `marketplace_items` record (existing FK).
- Before: save lock began after asynchronous moderation; after: lock starts before it, avoiding simultaneous save attempts.
- Before: fixed field grid and small labels/chips. After: mobile stacking, larger touch targets, RTL readiness checklist, legible text, and bottom safe-area padding.
- After successful insert: explicit confirmation screen linked to the new marketplace item or user's listing management.

## Verification and blockers
- Added unit test cases to `tests/productLocation.test.cjs` for the pure preview price formatter in `lib/productLocationRules.ts`.
- Confirmed by source inspection that `app/marketplace-item.tsx` reads the existing `business_id` foreign key and `hayna_ensure_my_business` returns a UUID; no migration needed.
- Direct local clone/test could not run in current container because `github.com` DNS is unavailable. CI/Vercel check outcome must be verified from PR commit status.
- Manual photo permission / geolocation / device checks require a real signed-in account and a device with location permission.
- Do not claim live publication until production commit and Vercel deployment are confirmed.


## Next section
Product-image multi-photo gallery is conditional on database support; do not silently add unsupported fields.
