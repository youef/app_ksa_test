-- Stored RLS function references do not require exposing the internal schema.
-- Keep per-function EXECUTE grants; authenticated callers use public RPCs only.
revoke usage on schema app_private from anon,authenticated;
