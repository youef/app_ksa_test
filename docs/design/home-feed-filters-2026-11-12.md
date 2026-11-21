# Home feed toolbar — UX/UI batch (2026-11-12)

## Design plan (before implementation)
Scope: home feed sorting and active-filter toolbar only. Preserve existing Oasis colors, RTL flow, feed logic, and bottom navigation. Make interactive targets at least 44pt tall, provide explicit screen-reader labels and state for sorting, and expose active-filter count and filter-dialog purpose. Avoid unrelated changes.

## Before / after
- Before: filter and sort hit targets depended on compact style heights; after: minimum 44pt high and filter button at least 72pt wide.
- Before: sort options exposed selected state but no explicit accessible label; after: labels announce sorting choice and selected state.
- Before: filter control had a generic name; after: it announces active-filter count and describes the dialog.
- Before: active filter removal chips could be short; after: minimum 44pt high with existing removal labels.

## Validation / release gate
- Static code inspection: four targeted JSX replacements applied to `app/home.tsx`.
- TypeScript, Web build, automated tests and iPhone/Android/iPad visual verification: pending CI/manual execution; not claimed as passed.
- PR must remain draft; no merge or deployment before all required checks and review pass.

## Next section
Home feed request/question card hierarchy, metadata spacing, loading and error presentation across viewport sizes.
