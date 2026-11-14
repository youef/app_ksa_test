# Notifications UX/UI — 2026-11-07

## Scope and baseline
Only `app/notifications.tsx`. Existing page has 32px destructive action, 36px modal close, no explicit list refresh affordance, filter chips without spoken names, and empty filtered states without a quick reset. Keep existing navigation, notification queries, and settings behavior.

## Design plan (before implementation)
1. Reuse OASIS colors, existing AppHeader and bottom navigation inset; avoid adding another header or global layout changes.
2. Give primary filter/action controls at least 44px hit targets while keeping compact visual icons. Add meaningful accessibility labels and selected states in RTL.
3. Use the existing refresh state and reload callback to offer an accessible refresh control. Retain content while refreshing and expose a busy indicator.
4. Provide a contextual reset action when filtered results are empty; preserve the genuine empty-inbox explanation.
5. Make the settings sheet dismissible through the Android back button and give its close button a spoken label.
6. Keep existing notification item logic, routing, color semantics and Supabase writes unchanged. Avoid unneeded animation to respect performance.

## Verification gate
TypeScript, web bundle and repository tests via GitHub Actions; no merge or production deployment before checks and required review.

## Before / after
Before: tiny destructive controls; ambiguous filter accessibility; empty filtered view lacks recovery; modal close not labeled.
After: 44px actions and settings close, spoken filter selection and notification card state, refresh feedback and empty-state reset, Android modal back support.

## Next candidate
`app/search.tsx` — search result density, empty/error states and responsive RTL layout. Do not revisit notifications next run unless regression is reported.
