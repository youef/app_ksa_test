# Home feed refresh & return-to-top — 2026-11-14

## Design plan (before implementation)
Scope: `app/home.tsx` only. Preserve existing feed, filters, navigation and backend behavior.
- Pull-to-refresh: keep native RefreshControl, prevent an unhandled rejection from leaving the loading indicator stuck, expose a screen-reader announcement of progress.
- Return to top: show a small floating, accessible 48px control only after substantial scrolling, keep it above bottom navigation and safe-area inset, and use the existing scroll ref.
- Visual language: Oasis theme tokens for surface, border, text and primary; RTL-friendly placement and label; avoid decorative motion.
- Responsive: button aligned to the feed's constrained width on tablet/web and inside viewport on phones; no overlap with bottom navigation.
- Validation: run TypeScript, web export and available tests; keep draft PR until checks and review pass.

## Before
Native refresh has no finally cleanup if reload rejects. The scroll-top event exists, but there is no visible return-to-top control for long feeds.

## After / validation
Implemented in `app/home.tsx`:
- Added floating 48×48 return-to-top button after scrolling past 700px, with Arabic accessibility label/hint, themed colors, and offset above bottom navigation.
- Ensured refresh spinner resets in a `finally` block after the feed reload.
- Preserved existing scroll event navigation behavior and native pull-to-refresh.

Validation: GitHub file writes succeeded. Local checkout and TypeScript/web/test execution blocked by DNS resolution failure (`Could not resolve host: github.com`). No device screenshots or manual review. PR remains draft, unmerged and unpublished.

Next section: Home location/weather context cards: small-screen wrapping, spacing and loading states.
