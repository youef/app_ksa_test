create or replace function public.hayna_admin_story_storage_metrics()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare result jsonb;
begin
 if (select p.role from public.profiles p where p.id=auth.uid()) is distinct from 'admin' then
  raise exception 'Forbidden' using errcode='42501';
 end if;
 select jsonb_build_object(
 'total_bytes',coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0),
 'objects',count(*),
 'uploaded_24h',count(*) filter(where created_at>=now()-interval '24 hours'),
 'bytes_24h',coalesce(sum(coalesce((metadata->>'size')::bigint,0)) filter(where created_at>=now()-interval '24 hours'),0),
 'daily',coalesce((select jsonb_agg(jsonb_build_object('day',day,'bytes',bytes,'files',files) order by day)
 from (select date_trunc('day',created_at)::date as day,count(*) as files,
 sum(coalesce((metadata->>'size')::bigint,0)) as bytes from storage.objects
 where bucket_id='story-media' and created_at>=now()-interval '14 days'
 group by 1) d),'[]'::jsonb),
 'cleanup',coalesce((select jsonb_agg(jsonb_build_object('time',started_at,'scanned',scanned,'removed',removed,'failed',failed))
 from (select started_at,scanned,removed,failed from app_private.story_cleanup_runs order by started_at desc limit 10) r),'[]'::jsonb),
 'alerts',coalesce((select jsonb_agg(jsonb_build_object('time',created_at,'kind',kind,'details',details))
 from (select created_at,kind,details from app_private.story_system_alerts where resolved_at is null order by created_at desc limit 10) a),'[]'::jsonb))
 into result from storage.objects where bucket_id='story-media';
 return result;
end $$;