# Home header refinement — 2026-11-15

## Plan before implementation
Scope: shared AppHeader home variant only, keeping other variants and navigation intact. Improve home header's compact-screen hierarchy, accessible unread announcements, decorative badge semantics, and brand identification. Preserve existing Oasis palette, 44px touch targets, RTL order and safe-area handling. Avoid changes to auth, notifications, routing or data.

## Before
Home logo exposed only as image; notification badges visually repeat the unread count already announced by the button; fixed header side widths may crowd compact screens.

## Proposed after
Accessible home brand name, decorative badges hidden from screen readers, responsive side widths on narrow phones while keeping 44px actions, and readable labels. Verify TypeScript, web build, available tests and iPhone/Android/iPad/web review before merge.

## Verification
Pending implementation and checks. Do not merge or deploy before checks and review.

## Next section
Stories strip in home feed.
