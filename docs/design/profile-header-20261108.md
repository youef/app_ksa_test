# Profile header UX/UI — 2026-11-08

## Scope and priority
Improve the shared profile header in components/profile/ProfileHeader.tsx, used by account and public profiles. This follows favorites, notifications and search design batches. No data or security changes.

## Before (code review)
- Settings and customization icon buttons shrink to 36px on phones, below 44px touch targets.
- Under 380px the actions force a full-width second row and waste vertical space.
- Non-interactive avatar and empty cover preview may appear actionable.
- Follow state and statistics actions lack selected/count accessibility descriptions.
- Metadata may overflow narrow screens or large text.

## Design plan — written before implementation
1. Preserve gradient, identity badges, imagery and brand palette.
2. Improve compact action wrapping without imposing a rigid second row.
3. Keep interactive touch areas at least 44 by 44.
4. Expose selection and spoken counts to assistive technologies.
5. Make metadata wrap and shrink naturally in RTL.
6. Preserve follow, contact, stats and editing behavior.

## Verification and release gate
Add static regression tests; run TypeScript and Web/platform CI; await required review before merge or deployment. Document after-state and test outcomes in PR. Next target: public profile content cards.
