# Backend audit — 26 October 2026

Project: `vkeuyompnddqfvulalkk` (Hayna). This audit covers deployed Supabase resources and the application integration; it is not a backup/export operation.

## Applied and verified

- Removed 500 business fixtures with explicit synthetic/demo markers and no dependent records. Recovery copy is private and ignored under `build/backend-audit/`; it is not published to GitHub.
- Restricted administrative RPCs and generic counter mutation; protected authentication fields against ordinary-user updates.
- Enabled invoker security for conversation previews, map activities and request directory views.
- Restricted conversation membership and read receipts; switched service/request chat creation to the protected direct-conversation RPC.
- Made `chat-media` private. Only uploaders and conversation participants can sign matching image paths; new messages store paths, and the renderer also handles legacy URLs. Signatures expire after ten minutes.
- Deployed all four maintenance functions with JWT verification plus active-admin/service authorization. Replaced placeholder web-push code and queries against nonexistent columns with database maintenance functions.
- Enabled native database schedules: broadcasts every minute, counters every five minutes, notification retention Sunday 03:00 UTC, weekly admin report Sunday 09:00 UTC. Weekly report receipts prevent duplicate delivery.
- Routed manual/immediate broadcasts through admin-only RPCs, selected recipients on the server, and serialized scheduled delivery against cron. Cancellation only changes pending broadcasts. Zero-recipient rollback tests verified repeat-send protection.
- Verified both frequent cron jobs ran successfully. Weekly jobs passed rollback tests; they remain scheduled for their next normal execution.
- Added 47 missing foreign-key indexes and the funnel table primary key. The missing-FK-index check now returns zero.
- Repaired Arabic/punctuation search in the admin RPC and restricted internal analytics/report RPCs to server execution.
- Moved legacy admin TOTP settings into a private table, updated both management RPCs, and enforced a null public secret column. Atomic compatibility tests checked enable/disable, non-admin rejection, secret isolation and fixture rollback. This does not enroll a user into Supabase Auth MFA.
- Removed the obsolete test-data purge function and its admin card, which contained fixed fixture counts and unsafe name-based deletion heuristics.
- Saved the previously remote-only `admin-users` function, blocked banned staff and corrected the SDK soft-delete argument.
- Integration fixtures were rolled back; the final fixture count is zero.

## Outstanding dashboard actions

- `quick-function` has been replaced with a retired handler (HTTP 410 after gateway authentication) and cannot issue LiveKit tokens. It has **not** been deleted: the connector has no deletion tool, the CLI has no login, and the accessible dashboard browser still requests login. The owner explicitly approved deletion. Complete it after signing into that browser or the Supabase CLI. `livekit-token` remains active and is the endpoint used by the application.
- Supabase Auth leaked-password protection remains disabled. The connected tools cannot update that setting; enable it in the authenticated dashboard if the project's plan supports it.

## Advisory interpretation

The invoker-view, mutable-search-path, missing-FK-index and missing-primary-key findings were addressed. Remaining adviser findings still require contextual review: executable SECURITY DEFINER RPCs (including intended guest/authenticated helpers), overlapping RLS policies, repeated auth expressions, and duplicate indexes. Unused-index observations alone are not grounds to drop indexes. Private tables intentionally have no client RLS policies and no client table privileges. This report does not claim that all adviser warnings are cleared.

References: [Supabase database linter](https://supabase.com/docs/guides/database/database-linter), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [Edge function auth context](https://supabase.com/docs/guides/functions/auth).
