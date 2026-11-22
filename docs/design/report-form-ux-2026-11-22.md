# Report form UX — design plan (2026-11-22)

## Selected screen and priority
- Screen: `app/report.tsx` — report submission and private report-history feedback.
- Priority: high-trust interaction. The screen asks residents to identify potentially harmful content, so the interface must feel calm, clear, deliberate, and accessible without weakening the seriousness of the action.
- Collision check: no currently open pull request targets the report screen. Existing report/security work is out of scope; this batch is presentation and interaction feedback only.

## Baseline (before)
- The form begins immediately with a plain section title; there is no concise explanation of what happens after a report is sent.
- Reason rows use 13px text, 12px vertical padding, and a 20px radio indicator. The rows do not expose a radio role or selected state to assistive technology.
- The optional detail field has a fixed 100px container and no accessible label or supporting hint.
- The submit button relies on opacity and a spinner; it has no explicit accessible busy/disabled state and no inline error recovery.
- The private report-history list is silently omitted while loading or after a read failure, so a resident cannot distinguish loading, an empty history, and an unavailable history.
- The scroll container uses a small fixed bottom padding and the form card has no capped width for tablet/desktop layouts.

## Design decisions
1. Preserve `AppHeader`, OASIS theme tokens, existing reason strings, the `reports` table and insert payload, auth redirect, success confirmation, and navigation.
2. Add a concise shield-led introduction explaining that reports are reviewed by the Hayna team; avoid alarmist copy or decorative urgency.
3. Center the page content with a 760px maximum width and a 22px-radius card; use consistent OASIS surface, border, ink, muted, soft, and danger tokens.
4. Make each reason a clearly selected semantic radio option with at least a 56px row height, 44px-plus control surface, readable 14px text, and a two-column layout only when the viewport is wide enough.
5. Give the optional details field a visible label, accessible label/hint, comfortable multiline area (minimum 120px), and clear helper copy.
6. Make submission a 52px minimum-height action with an accessible busy/disabled state. Keep errors in the form as a recoverable, announced message while preserving the existing success confirmation and auth redirect.
7. Give private report history explicit loading, retryable error, empty, and populated states. Keep the current six-record limit and query unchanged.
8. Respect the shared bottom navigation inset and natural keyboard-aware scrolling; rely on `AppHeader` for the top safe area.

## Scope and non-goals
- In scope: `app/report.tsx`, a focused UI contract test, this design record, and a scoped GitHub Actions workflow.
- Out of scope: database/schema/RLS changes, report policy or reason taxonomy changes, new moderation behavior, routing changes, and all unrelated screens or security maintenance.

## Acceptance and verification
- TypeScript: `npm run typecheck`.
- Web: `npm run export:web`.
- Focused UI contract: `node --test tests/reportDesign.test.cjs`.
- Full repository suite is intentionally not run in this batch because it includes unrelated game/streaming suites outside the requested scope.
- Manual QA still required on iPhone, Android, iPad, and web at narrow and wide widths, in light/dark themes, with VoiceOver/TalkBack and keyboard open. This environment cannot claim physical-device QA.

## Before / after summary
- Plain form-first layout → calm, trust-oriented intro and clear content hierarchy.
- Small non-semantic reason rows → larger, accessible selected radio cards.
- Fixed small text field → labeled multiline field with a spacious touch area.
- Spinner/opacity only → explicit busy state and inline error recovery.
- Silent report-history omission → loading, error/retry, empty, and populated states.
- Fixed small bottom padding → shared bottom-nav inset and centered responsive width.

## Next candidate after review
- `app/service.tsx` — inspect the resident-facing service detail and action hierarchy; do not touch it in this batch.
