# Contact Us UX/UI Plan — 2026-11-21

## Scope and baseline
Single screen: `app/contact-us.tsx`. No changes to support-ticket schema, delivery logic, routes, authentication, moderation, or other pages.

Source review baseline:
- Form sits in one card with 14px page/card padding, 14px radius and no explicit content-width cap.
- Field labels are visible, but inputs do not have explicit accessibility labels.
- Message textarea is 110px minimum and has no length cap or visible counter.
- Input borders use a fixed light-mode slate color instead of the existing OASIS theme line token.
- Submit button has vertical padding but no guaranteed minimum touch height.
- Bottom clearance already uses `useBottomNavInset`; keep it.

## Design plan (before code)
1. **Hierarchy:** create a compact intro area within the form card using a 46px icon tile, clear title, and one short helper sentence. Keep the header unchanged.
2. **Form surface:** use theme-aware OASIS colors, 18px card radius, 16px inner spacing/padding, and a responsive centered column capped at 560px. Keep 16px side gutters on narrow screens.
3. **Inputs:** consistent 44px minimum single-line fields; theme line/surface colors; 12px radii. Keep labels adjacent and right aligned. Give each control a meaningful accessibility label. Email uses email keyboard, no autocapitalization/correction. Subject/name/email have practical character caps.
4. **Message field:** multiline minimum 120px, maximum 2000 characters, right-aligned, and show an unobtrusive RTL count (current / 2000) below it.
5. **Submit state:** 48px minimum action height; consistent icon/text alignment; retain disabled/busy behavior and clearly label busy state for assistive technology.
6. **Responsive / safe area:** 100% width with a 560px maximum, centered on web/tablet, scroll naturally on phones, and preserve the existing bottom navigation inset. Avoid fixed-height layout and decorative motion.
7. **Behavior preservation:** keep existing Supabase insert, validation, success/error alerts and reset behavior; no backend or privacy changes.

## Before / after
- Before: single card with sparse heading, unbounded width, fixed-color field outlines, unlabeled controls to screen readers, and no message length feedback.
- After: clear intro/form hierarchy, theme-consistent card and fields, centered responsive width, labeled controls, predictable field heights, live character count and an accessible submit state.

## Acceptance checks
- UI contract test for width/radius/spacing tokens, field labels, max length/counter, accessible names, and submit busy state.
- `npm run typecheck`, `npm run export:web`, and available Node tests in CI.
- Manual visual QA on iPhone/Android/iPad/web and VoiceOver/TalkBack remains a reviewer/device gate; no real-device screenshots are claimed here.

## Next UI target
`app/rate-app.tsx` (feedback / app rating page), after this PR is reviewed; check for overlap before starting.
