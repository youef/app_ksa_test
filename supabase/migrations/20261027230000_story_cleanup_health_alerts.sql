create table if not exists app_private.story_system_alerts (
 id bigint generated always as identity primary key, kind text not null,
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 resolved_at timestamptz
);
revoke all on app_private.story_system_alerts from public,anon,authenticated;
create or replace function app_private.check_story_cleanup_health()
returns void language plpgsql security definer set search_path=''
as $$
declare last_run timestamptz; failures integer;
begin
 select max(started_at),coalesce((select failed from app_private.story_cleanup_runs order by started_at desc limit 1),0)
 into last_run,failures from app_private.story_cleanup_runs;
 if (last_run is null or last_run<now()-interval '45 minutes' or failures>0)
 and not exists(select 1 from app_private.story_system_alerts where kind='story_cleanup'
 and resolved_at is null and created_at>now()-interval '2 hours') then
 insert into app_private.story_system_alerts(kind,details)
 values('story_cleanup',jsonb_build_object('last_run',last_run,'failures',failures));
 end if;
 delete from app_private.story_system_alerts where created_at<now()-interval '30 days';
end $$;
revoke all on function app_private.check_story_cleanup_health() from public,anon,authenticated;
select cron.schedule('hayna-story-cleanup-health-hourly','7 * * * *','select app_private.check_story_cleanup_health()');