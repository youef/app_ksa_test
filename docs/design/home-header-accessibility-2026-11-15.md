# Home header refinement — 2026-11-15

## Plan before implementation
Scope: shared AppHeader home variant only, keeping other variants and navigation intact. Improve home header's compact-screen hierarchy, accessible unread announcements, decorative badge semantics, and brand identification. Preserve existing Oasis palette, 44px touch targets, RTL order and safe-area handling. Avoid changes to auth, notifications, routing or data.

## Before
Home logo exposed only as image; notification badges visually repeat the unread count already announced by the button; fixed header side widths may crowd compact screens.

## After
Implemented accessible home brand name and clarified profile/sign-in hints; unread count badges are decorative for screen readers because the parent action already announces the count. Existing RTL, Safe Area, Oasis colors, 44px actions and header dimensions are preserved. Responsive side-width changes were intentionally deferred to avoid altering shared layouts without device verification. Verify TypeScript, web build, available tests and iPhone/Android/iPad/web review before merge.

## Verification
Implementation committed. Local clone failed due DNS (`Could not resolve host: github.com`); TypeScript, web build, tests and device checks are unverified. Do not merge or deploy before checks and review.

## Next section
Stories strip in home feed.
