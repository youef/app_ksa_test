# Business details UX — 2026-11-10

## Scope and design plan (before implementation)
Only `app/business.tsx`. Prioritize a calm, legible business hero, accessible image previews and opening-hours disclosure, and resilient cards for narrow iPhone/Android widths, iPad and web. Preserve existing Oasis theme, Arabic RTL, AppHeader, bottom-navigation inset, data loading, and business operations. Avoid backend and unrelated changes.

## Before → after
- Cover was 170px and image preview controls offered no hint → 190px cover, explicit preview hints; unavailable images still use existing fallback.
- Business name lacked a semantic heading → accessible header.
- Three equal-width summary cards could crowd on compact screens → wrapping cards with 105px flex basis and more horizontal padding.
- Contact labels could crowd → slightly larger readable type, wrapping-safe label and bounded button width.
- Hours disclosure had no spoken action label or visual expanded cue → descriptive label/hint and rotating chevron; opening-hour rows align at top for multi-line times.
- Load-more reviews had no announced busy state → role, label and busy/disabled state.
- Service rows could be short → 56px minimum touch height.

## Validation and release gate
Review the PR checks for TypeScript, web/platform bundles and existing tests. No merge or production release before successful checks and required review. Native device appearance remains to be checked manually.

## Next section
Business creation/editing sheet: form hierarchy, field validation feedback, keyboard avoidance and compact-device spacing.
