# Home weather tile — UX/UI design plan (2026-11-14)

## Scope and baseline (before editing)
Only `components/home/AtmosphereBar.tsx`, the weather tile shown beside the location tile on Home. Before: the compact state displayed the awkward phrase «جارٍ الطقس...», had a small icon and no visible spinner; a weather request in progress could show old data without indicating it was being refreshed. The button's screen-reader label was generic and did not communicate the displayed temperature. Compact layout relied on a one-line truncated label.

## Plan, acceptance criteria
1. Preserve OasisGlassFrame, palette and navigation to /weather; do not change weather fetching or other Home components.
2. Compact: keep a 44px minimum touch target, clear weather icon, right-to-left content, and text truncation for narrow iPhones; maintain sensible width on iPad/web.
3. Distinguish initial loading, updating an existing reading, and unavailable weather. Use a small activity spinner only while loading, and keep the current reading visible during refresh.
4. Make accessible label reflect weather state and current reading, with a clear navigation hint; avoid duplicative live announcements.
5. Respect current theme and avoid new animations beyond the platform activity indicator.

## Verification plan
Run `npm run typecheck`, `npm run build`, and available tests; inspect narrow iPhone, Android, iPad, and web layout including RTL and dark mode. Keep PR draft until checks and review succeed.

## Implemented — before / after
- **Before:** ambiguous compact loading message and static weather icon during loading. **After:** explicit «جارٍ جلب الطقس…» and a native activity indicator while loading; an existing weather reading remains visible during refresh.
- **Before:** generic screen-reader button name. **After:** one state-aware Arabic button label containing temperature/condition or unavailable/loading state and destination.
- **Before:** compact label could crowd the icon. **After:** RTL row, text shrinking/truncation and 44px minimum touch height.
- No weather data fetching, navigation destination, or global styles changed.

## Results and blockers
- GitHub branch and code changes committed successfully.
- Local checkout failed on 2026-11-14: `Could not resolve host: github.com` (DNS). Thus TypeScript, Expo Web build, automated tests, and device previews could not be run locally. No passing CI status is claimed.
- PR must remain draft; no merge or deployment until checks and review pass.

## Next section
Home location scope tile: modal readability, selected-state affordance, and accessible close controls, without changing geolocation logic.
