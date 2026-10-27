-- Scheduled story media cleanup: one-time token, no static secrets in cron.
create schema if not exists app_private;
create table if not exists app_private.story_cleanup_tokens (
 token_hash text primary key,
 expires_at timestamptz not null,
 consumed_at timestamptz
);
revoke all on app_private.story_cleanup_tokens from public, anon, authenticated;
create or replace function public.hayna_consume_story_cleanup_token(p_token text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_found boolean;
begin
 if p_token is null or length(p_token) <> 64 or p_token !~ '^[0-9a-f]{64}$' then return false; end if;
 update app_private.story_cleanup_tokens set consumed_at=now()
 where token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
 and expires_at>now() and consumed_at is null returning true into v_found;
 return coalesce(v_found,false);
end $$;
revoke all on function public.hayna_consume_story_cleanup_token(text) from public, anon, authenticated;
grant execute on function public.hayna_consume_story_cleanup_token(text) to service_role;
create or replace function app_private.dispatch_story_media_cleanup()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_token text;
begin
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into app_private.story_cleanup_tokens(token_hash,expires_at)
 values(encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '3 minutes');
 delete from app_private.story_cleanup_tokens where expires_at<now()-interval '1 day';
 perform net.http_post(
 url:='https://vkeuyompnddqfvulalkk.supabase.co/functions/v1/cleanup-story-media',
 headers:=jsonb_build_object('Content-Type','application/json','x-hayna-cleanup-token',v_token),
 body:='{}'::jsonb,timeout_milliseconds:=120000);
end $$;
revoke all on function app_private.dispatch_story_media_cleanup() from public, anon, authenticated;
select cron.schedule('hayna-story-media-cleanup-15min','*/15 * * * *','select app_private.dispatch_story_media_cleanup()');