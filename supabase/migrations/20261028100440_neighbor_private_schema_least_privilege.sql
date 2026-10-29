-- Stored RLS references continue to execute their explicitly granted functions.
revoke usage on schema app_private from anon,authenticated;
