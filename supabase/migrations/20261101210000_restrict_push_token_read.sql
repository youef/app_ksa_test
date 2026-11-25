-- Security hardening: push token read isolation.
-- Apply only after migrating cross-user notification delivery to a trusted
-- server-side sender (service role), otherwise some client push paths may fail.
-- Reversible: recreate the old broad policy only in an emergency, with
-- explicit security approval; prefer rolling back the client sender instead.
BEGIN;
DROP POLICY IF EXISTS "Authenticated users can read tokens for notifications" ON public.push_tokens;
-- Existing "Users can manage own tokens" and "push tokens own" policies
-- continue to allow authenticated owners to read/register/unregister.
DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='push_tokens'
     AND cmd='SELECT' AND qual='true'
     AND ('authenticated'=ANY(roles) OR 'public'=ANY(roles))
 ) THEN
   RAISE EXCEPTION 'Broad push token SELECT policy still exists';
 END IF;
END $$;
COMMIT;
