-- Platform governance: feature flags / maintenance mode + lightweight RBAC
-- Safe to run repeatedly (idempotent).

-- ============================================================
-- 1) app_config : DB-driven feature flags & maintenance mode
-- ============================================================
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config
  for select using (true);

drop policy if exists app_config_admin_write on public.app_config;
create policy app_config_admin_write on public.app_config
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

insert into public.app_config (key, value, description) values
  ('maintenance_mode',
   '{"enabled": false, "message": "التطبيق تحت الصيانة، سنعود قريبًا بإذن الله."}'::jsonb,
   'وضع الصيانة العام'),
  ('feature_flags',
   '{"weather": true, "market": true, "carpooling": true, "stories": true, "urgent_alerts": true, "rewards": true}'::jsonb,
   'مفاتيح تشغيل/إيقاف ميزات التطبيق')
on conflict (key) do nothing;

-- ============================================================
-- 2) RBAC : named admin roles + assignments
--    (additive on top of profiles.role = 'admin')
-- ============================================================
create table if not exists public.admin_roles (
  key text primary key,
  label text not null,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_role_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null references public.admin_roles(key) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_key)
);

alter table public.admin_roles enable row level security;
alter table public.admin_role_assignments enable row level security;

drop policy if exists admin_roles_read on public.admin_roles;
create policy admin_roles_read on public.admin_roles
  for select using (true);

drop policy if exists admin_roles_admin_write on public.admin_roles;
create policy admin_roles_admin_write on public.admin_roles
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists admin_role_assignments_read on public.admin_role_assignments;
create policy admin_role_assignments_read on public.admin_role_assignments
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists admin_role_assignments_admin_write on public.admin_role_assignments;
create policy admin_role_assignments_admin_write on public.admin_role_assignments
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

insert into public.admin_roles (key, label, description, permissions) values
  ('owner', 'مالك المنصة', 'صلاحيات كاملة على كل أقسام مركز العمليات.', '{"all": true}'::jsonb),
  ('moderator', 'مشرف محتوى', 'إدارة البلاغات والمحتوى والمنشورات.', '{"reports": true, "content": true, "search": true}'::jsonb),
  ('verifier', 'مسؤول التوثيق', 'اعتماد طلبات التوثيق والتحقق الجغرافي.', '{"verifications": true, "users": true}'::jsonb),
  ('support', 'دعم المستخدمين', 'متابعة المستخدمين وإرسال التنبيهات.', '{"users": true, "broadcast": true}'::jsonb)
on conflict (key) do nothing;

-- ============================================================
-- 3) scheduled_broadcasts : queue announcements for later
-- ============================================================
create table if not exists public.scheduled_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  broadcast_type text not null default 'official',
  target jsonb not null default '{"scope":"all","segment":"all"}'::jsonb,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.scheduled_broadcasts enable row level security;

drop policy if exists scheduled_broadcasts_admin_read on public.scheduled_broadcasts;
create policy scheduled_broadcasts_admin_read on public.scheduled_broadcasts
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists scheduled_broadcasts_admin_write on public.scheduled_broadcasts;
create policy scheduled_broadcasts_admin_write on public.scheduled_broadcasts
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create index if not exists scheduled_broadcasts_due_idx
  on public.scheduled_broadcasts (status, scheduled_at);
