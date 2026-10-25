-- Violation reports are written only by trusted database functions and triggers.
-- Clients use hayna_report_own_prohibited_content instead of direct inserts.
drop policy if exists "users insert violations" on public.moderation_violations;
revoke insert on public.moderation_violations from authenticated;
