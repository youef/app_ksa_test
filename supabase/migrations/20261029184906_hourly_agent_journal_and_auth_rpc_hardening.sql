
-- HAYNA AI hourly operations journal; append-only for server operator and admin-only reading.
create table if not exists public.ai_agent_events (
 id uuid primary key default gen_random_uuid(),
 event_key text unique,
 source text not null default 'github_actions',
 component text not null default 'engineering',
 phase text not null default 'diagnostic',
 status text not null default 'reported'
   check (status in ('planned','detected','running','reported','fixed','verified','failed','blocked','skipped')),
 severity text not null default 'info'
   check (severity in ('info','low','medium','high','critical')),
 summary text not null,
 decision text not null default '',
 plan jsonb not null default '[]'::jsonb,
 details jsonb not null default '{}'::jsonb,
 result jsonb not null default '{}'::jsonb,
 cost_tier text not null default 'deterministic',
 source_url text,
 created_at timestamptz not null default now()
);
create index if not exists ai_agent_events_created_idx on public.ai_agent_events(created_at desc);
create index if not exists ai_agent_events_component_idx on public.ai_agent_events(component,created_at desc);
alter table public.ai_agent_events enable row level security;
revoke all on public.ai_agent_events from public,anon,authenticated;
grant select on public.ai_agent_events to authenticated;
create policy ai_agent_events_admin_read on public.ai_agent_events
 for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and coalesce(p.is_banned,false)=false)
 );
comment on table public.ai_agent_events is 'Auditable operational decisions, plans, tests and outcomes. Writes server-side only.';

-- Remove publicly writable unbounded analytics. Only the validated event RPC can write.
revoke all on public.analytics_events from public,anon,authenticated;
drop policy if exists analytics_events_insert on public.analytics_events;
create or replace function public.log_analytics_event(
 p_event_name text,p_entity_type text default null,p_entity_id uuid default null,p_properties jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=pg_catalog as $f$
declare actor uuid := auth.uid();
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_event_name not in ('app_open','authenticated','account_created','location_set','home_view','section_open','content_created','first_content_created','content_interacted','app_return')
 then raise exception 'Unsupported analytics event' using errcode='22023'; end if;
 if p_entity_type is not null or p_entity_id is not null
 then raise exception 'Server-owned content analytics' using errcode='22023'; end if;
 if p_properties is null or jsonb_typeof(p_properties)<>'object' or pg_column_size(p_properties)>512 or
   exists(select 1 from jsonb_object_keys(p_properties) k where k <> 'section')
 then raise exception 'Unsupported analytics properties' using errcode='22023'; end if;
 if p_event_name='section_open' and (p_properties->>'section') not in ('home','questions','requests','market','stories','tools','events','explore','profile','other')
 then raise exception 'Invalid section' using errcode='22023'; end if;
 if p_event_name<>'section_open' and p_properties <> '{}'::jsonb
 then raise exception 'Unexpected analytics properties' using errcode='22023'; end if;
 insert into public.analytics_events(user_id,event_name,entity_type,entity_id,properties)
 values(actor,p_event_name,null,null,p_properties);
end $f$;
revoke all on function public.log_analytics_event(text,text,uuid,jsonb) from public,anon;
grant execute on function public.log_analytics_event(text,text,uuid,jsonb) to authenticated;

-- Authenticated-only RPCs were unintentionally executable by anonymous clients.
revoke all on function public.assert_is_admin() from public,anon;
grant execute on function public.assert_is_admin() to authenticated;
revoke all on function public.clear_conversation_for_me(uuid) from public,anon;
grant execute on function public.clear_conversation_for_me(uuid) to authenticated;
revoke all on function public.delete_conversation(uuid) from public,anon;
grant execute on function public.delete_conversation(uuid) to authenticated;
revoke all on function public.set_conversation_mute(uuid,boolean) from public,anon;
grant execute on function public.set_conversation_mute(uuid,boolean) to authenticated;
revoke all on function public.record_story_view(uuid) from public,anon;
grant execute on function public.record_story_view(uuid) to authenticated;
revoke all on function public.hayna_neighbor_access(text,text) from public,anon;
grant execute on function public.hayna_neighbor_access(text,text) to authenticated;
revoke all on function public.search_all_content(text,uuid,text,text,text[],integer) from public,anon;
grant execute on function public.search_all_content(text,uuid,text,text,text[],integer) to authenticated;
