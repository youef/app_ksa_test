-- HAYNA AI Agent v1: additive, admin-read-only audit storage.
-- The workflow can write with a server-side service credential. Client sessions have read-only admin access.
create table if not exists public.ai_agent_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'github_actions',
  run_type text not null default 'engineering_audit',
  status text not null check (status in ('passed','warning','failed','running')),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  source_url text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_agent_runs_started_at_idx on public.ai_agent_runs (started_at desc);
alter table public.ai_agent_runs enable row level security;
revoke all on public.ai_agent_runs from anon, authenticated;
grant select on public.ai_agent_runs to authenticated;
do $sql$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_agent_runs' and policyname='ai_agent_runs_admin_read') then
    create policy ai_agent_runs_admin_read on public.ai_agent_runs for select to authenticated
    using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
  end if;
end
$sql$;
create table if not exists public.ai_agent_proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('bug','security','database','performance','feature','release')),
  risk text not null default 'medium' check (risk in ('low','medium','high','critical')),
  status text not null default 'proposed' check (status in ('proposed','in_review','approved','rejected','shipped')),
  rationale text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  source_url text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists ai_agent_proposals_created_idx on public.ai_agent_proposals (created_at desc);
alter table public.ai_agent_proposals enable row level security;
revoke all on public.ai_agent_proposals from anon, authenticated;
grant select on public.ai_agent_proposals to authenticated;
do $sql$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_agent_proposals' and policyname='ai_agent_proposals_admin_read') then
    create policy ai_agent_proposals_admin_read on public.ai_agent_proposals for select to authenticated
    using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
  end if;
end
$sql$;
comment on table public.ai_agent_proposals is 'AI suggestions only. No proposal causes SQL, repository writes, or releases automatically.';
