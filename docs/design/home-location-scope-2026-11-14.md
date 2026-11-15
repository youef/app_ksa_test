# Home location scope — design batch (2026-11-14)

## Plan written before implementation
Scope: `components/LocationScopeBar.tsx` only, displayed above the home feed. Preserve real-device geolocation, Saudi city verification, persistence and callbacks. Improve: visual hierarchy, Oasis theme tokens, right-to-left labels, responsive dialog width, Safe Area, minimum 44-point targets, accessibility descriptions, selected/busy states, and legible error handling. Avoid changing feed behavior or unrelated screens.

## Before
- 320px dialog with small 12px option labels, 8px corner radius and no descriptive context.
- Compact tile centered/truncated long Arabic locations, obscuring the useful city/district text.
- Nested no-op Pressable inside a dismissing Pressable, making dialog tap behavior brittle.
- Selected city background could appear before a valid city was established.
- Modal did not account for Safe Area insets.

## After
- A single centered responsive dialog (max 440px) with 24px radius and themed surfaces.
- Right-aligned, truncation-safe compact location tile, explicit open/close controls.
- Two 68px selection rows with icons, explanations, selected check and loading indicator.
- Safe Area padding, semantic header, accessible labels/hints and selected/busy states.
- Backdrop dismisses separately; selection keeps the dialog visible while resolving location and closes on success.
- City selected styling only when a verified city exists.
- Real-device geolocation and all validation/persistence paths remain unchanged.

## Verification
- Source reviewed via GitHub connector; branch commit created.
- Local git clone unavailable (DNS resolution of github.com failed).
- TypeScript (`npm run typecheck`), web (`npm run build`), tests and iPhone/Android/iPad visual review **not run**. PR must remain draft; no merge or deploy.
- Reviewer should verify permission denied, outside-KSA, unknown district, slow geocoding, dark/light themes, RTL and 320px/768px/desktop layouts.

## Next section
Home community shortcuts: icon/label hierarchy, overflow and responsive tap targets.
