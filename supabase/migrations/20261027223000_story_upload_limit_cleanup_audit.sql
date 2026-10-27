-- Story cleanup metrics are private and accessible only to the service role.
create table if not exists app_private.story_cleanup_runs(
 id bigint generated always as identity primary key,
 started_at timestamptz not null default now(),
 scanned integer not null default 0,
 removed integer not null default 0,
 failed integer not null default 0,
 protected integer not null default 0,
 error text
);
revoke all on app_private.story_cleanup_runs from public,anon,authenticated;
create or replace function public.hayna_record_story_cleanup(p_scanned integer,p_removed integer,p_failed integer,p_protected integer,p_error text default null)
returns void language plpgsql security definer set search_path=''
as $$
begin
 insert into app_private.story_cleanup_runs(scanned,removed,failed,protected,error)
 values(greatest(0,p_scanned),greatest(0,p_removed),greatest(0,p_failed),greatest(0,p_protected),left(p_error,500));
 delete from app_private.story_cleanup_runs where started_at<now()-interval '30 days';
end $$;
revoke all on function public.hayna_record_story_cleanup(integer,integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.hayna_record_story_cleanup(integer,integer,integer,integer,text) to service_role;
update storage.buckets set file_size_limit=2097152 where id='story-media';