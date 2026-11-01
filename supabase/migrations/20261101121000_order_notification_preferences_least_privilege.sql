-- Defense in depth: RLS does not guard TRUNCATE and does not replace table ACLs.
-- Existing owner-only RLS policies are preserved. No data is changed.
-- Previous migration granted ALL to anon and authenticated through default privileges.
REVOKE ALL PRIVILEGES ON TABLE public.order_notification_preferences FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.order_notification_preferences FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.order_notification_preferences TO authenticated;

-- Rollback, only after security review:
-- GRANT ALL PRIVILEGES ON TABLE public.order_notification_preferences TO anon, authenticated;
-- The rollback restores the old (overly broad) ACL and should not be used routinely.
