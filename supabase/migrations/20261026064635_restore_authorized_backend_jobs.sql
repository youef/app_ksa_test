create table if not exists app_private.backend_job_receipts(
 job_key text primary key, completed_at timestamptz not null default now(), result jsonb not null default '{}'::jsonb);
alter table app_private.backend_job_receipts enable row level security;
revoke all on app_private.backend_job_receipts from public,anon,authenticated;
create or replace function app_private.run_backend_job(p_task text)
returns jsonb language plpgsql security definer set search_path='' as $job$
declare changed bigint:=0; total bigint:=0; b record; report jsonb; week_start date; job_key text; result jsonb;
begin
 if p_task not in ('refresh-counters','notifications-cleanup','scheduled-broadcast-dispatch','weekly-admin-report') then
  raise exception 'Unknown maintenance task' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('backend-job:'||p_task,0));
 if p_task='refresh-counters' then
  with counts as(
   select p.id,
    (select count(*)::integer from public.notifications n where n.user_id=p.id and n.read_at is null) notifications,
    (select count(*)::integer from public.services s where s.provider_id=p.id) services,
    (select count(*)::integer from public.requests r where r.requester_id=p.id) requests,
    (select count(*)::integer from public.reports r where r.target_id=p.id) reports,
    (select count(*)::integer from public.questions q where q.author_id=p.id) questions,
    (select count(*)::integer from public.answers a where a.author_id=p.id) answers
   from public.profiles p)
  update public.profiles p set notifications_unread_count=c.notifications,services_count=c.services,
   requests_count=c.requests,reports_count=c.reports,questions_count=c.questions,answers_count=c.answers
  from counts c where p.id=c.id and
   row(p.notifications_unread_count,p.services_count,p.requests_count,p.reports_count,p.questions_count,p.answers_count)
   is distinct from row(c.notifications,c.services,c.requests,c.reports,c.questions,c.answers);
  get diagnostics changed=row_count;
  return jsonb_build_object('updated',changed);
 elsif p_task='notifications-cleanup' then
  delete from public.notifications where
   (read_at is not null and created_at<now()-interval '90 days')
   or(read_at is null and created_at<now()-interval '180 days');
  get diagnostics changed=row_count;
  return jsonb_build_object('deleted',changed);
 elsif p_task='scheduled-broadcast-dispatch' then
  for b in select * from public.scheduled_broadcasts where status='pending' and scheduled_at<=now()
   order by scheduled_at,id limit 20 for update skip locked
  loop
   if not exists(select 1 from public.profiles where id=b.created_by and role='admin' and not is_banned) then
    continue;
   end if;
   insert into public.notifications(user_id,type,title,body,data)
    select p.id,'broadcast',b.title,b.body,jsonb_build_object('broadcast_type',b.broadcast_type,'broadcast_id',b.id)
    from public.profiles p where not p.is_banned
    and(coalesce(b.target->>'scope','all')='all' or p.city=b.target->>'scope')
    and(case coalesce(b.target->>'segment','all')
     when 'all' then true when 'verified' then p.is_verified
     when 'unverified' then not p.is_verified when 'admins' then p.role='admin' else false end);
   get diagnostics changed=row_count;
   total:=total+changed;
   update public.scheduled_broadcasts set status='sent',sent_at=now() where id=b.id;
  end loop;
  return jsonb_build_object('recipients',total);
 else
  week_start:=date_trunc('week',now() at time zone 'UTC')::date;
  job_key:='weekly-admin-report:'||week_start::text;
  if exists(select 1 from app_private.backend_job_receipts r where r.job_key=run_backend_job.job_key) then
   return jsonb_build_object('already_sent',true);
  end if;
  report:=public.generate_weekly_report(week_start);
  insert into public.notifications(user_id,type,title,body,data)
   select id,'weekly_report','التقرير الأسبوعي — '||week_start::text,
    'مستخدمون جدد: '||coalesce(report#>>'{summary,new_users}','0')||' · بلاغات: '||coalesce(report#>>'{summary,reports_total}','0'),
    jsonb_build_object('type','weekly_report','week',week_start)
   from public.profiles where role='admin' and not is_banned;
  get diagnostics changed=row_count;
  result:=jsonb_build_object('week',week_start,'sent_to',changed);
  insert into app_private.backend_job_receipts(job_key,result) values(job_key,result);
  return result;
 end if;
end $job$;
revoke all on function app_private.run_backend_job(text) from public,anon,authenticated;
create or replace function public.backend_run_maintenance(p_task text)
returns jsonb language plpgsql security definer set search_path='' as $api$
begin
 if coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then
  perform public.assert_is_admin();
 end if;
 return app_private.run_backend_job(p_task);
end $api$;
revoke all on function public.backend_run_maintenance(text) from public,anon;
grant execute on function public.backend_run_maintenance(text) to authenticated,service_role;
