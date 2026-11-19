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

## Before → after
To be updated after implementation and checks.

## Next section
Product-image multi-photo gallery is conditional on database support; do not silently add unsupported fields.
