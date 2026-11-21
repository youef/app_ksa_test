# Cities picker UX — 2026-11-21

## Priority and scope
This batch focuses on `app/cities.tsx` (region → city selection). The screen already uses the shared `AppHeader`, Oasis palette, RTL row direction, and bottom-navigation inset; preserve those foundations and improve the picker without changing location data, routes, district selection, or global shell.

## Design plan (recorded before implementation)
1. **Hierarchy:** Add a compact region-context summary that explains the next step and shows the number of cities in the current filtered result. Keep it lightweight and avoid a second competing header.
2. **Search:** Use the existing Saudi Arabic location-name normalizer so hamza/diacritics/taa marbuta variations match consistently. Keep the field RTL and at least 48 px high; provide a clearly labeled, 44 px clear action only when a query is present.
3. **Cards:** Improve city cards to a consistent 76 px minimum touch height, 18 px radius, quieter border/shadow, balanced spacing, and a distinct icon surface. Announce each city and its district count through accessibility labels/hints.
4. **Empty state:** Add a friendly no-results state with a search icon, concise explanation, and a 44 px reset action; do not show a blank list or alter the underlying city data.
5. **Responsive/accessibility:** Use a centered, capped content width on large web/iPad layouts and full width with safe horizontal padding on phones. Keep native scrolling, keyboard search behavior, readable line heights, RTL alignment, and 44 px control targets. Respect the existing bottom-nav inset.
6. **Visual restraint/performance:** Use existing OASIS theme tokens for light/dark surfaces and text; avoid new animation packages, gradients, image loading, or per-item effects.

## Before (verified source audit)
- City search used raw `name.includes()`, so Arabic normalization variations did not match.
- Search had no clear affordance or explicit accessible label / keyboard return behavior.
- No result count or empty-results recovery; an unmatched query rendered an empty area.
- City rows had a 36 px icon box and 14 px padding; the list was not width-capped for web/tablet.
- An unconditional 100 px trailing spacer was present.

## After (implemented)
- Normalized Arabic filtering through a focused helper and the existing Saudi location normalizer.
- A region summary with a live result count, clear-search affordance, and search keyboard behavior.
- Accessible city/district labels and a no-results state with reset.
- 76 px minimum city rows, 44 px icon/clear targets, 18 px custom radius, theme-token border/surface, and restrained shadow.
- Centered 720 px max-width layout; redundant spacer removed and bottom-navigation inset retained.

## Verification
- Focused city picker tests: **3/3 passed** in isolated Node execution against a copied source snapshot.
- TSX transpile syntax: **0 diagnostics**.
- GitHub CI on the latest PR head is still running; TypeScript, Web/Android/iOS export and full-suite status are not yet final for the latest commit.
- Vercel preview for the latest branch commit is queued, not ready.
- Real iPhone/Android/iPad and VoiceOver/TalkBack review remains unperformed.

No production merge/deploy is authorized in this batch. Report only checks actually observed.
