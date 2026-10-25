create table if not exists public.platform_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  sender_label text not null default 'فريق حيّنا',
  title text,
  body text not null,
  type text not null default 'update' check (type in ('welcome','update','announcement','system')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- null recipient_id means broadcast to all (handled client-side by inserting per user or using a view)
alter table public.platform_messages enable row level security;

-- users read their own
drop policy if exists "users read own platform messages" on public.platform_messages;
create policy "users read own platform messages" on public.platform_messages for select to authenticated
using (recipient_id = auth.uid());

-- users can mark read
drop policy if exists "users update own platform messages" on public.platform_messages;
create policy "users update own platform messages" on public.platform_messages for update to authenticated
using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- admins manage all
drop policy if exists "admins manage platform messages" on public.platform_messages;
create policy "admins manage platform messages" on public.platform_messages for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and not p.is_banned))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and not p.is_banned));

grant select, insert, delete on public.platform_messages to authenticated;
revoke update on public.platform_messages from authenticated;
grant update(read) on public.platform_messages to authenticated;

-- Bootstrap the inbox for fresh databases; legacy migration timestamps may be ahead of the server clock.
create schema if not exists app_private;

create table public.platform_welcome_settings (
  id text primary key default 'welcome' check (id = 'welcome'),
  enabled boolean not null default true,
  title text not null check (length(btrim(title)) between 1 and 160),
  body text not null check (length(btrim(body)) between 1 and 5000),
  updated_at timestamptz not null default now()
);
alter table public.platform_welcome_settings enable row level security;
create policy welcome_admin_only on public.platform_welcome_settings for all to authenticated
  using (exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin' and not is_banned))
  with check (exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin' and not is_banned));
grant select,insert,update on public.platform_welcome_settings to authenticated;
insert into public.platform_welcome_settings(id,title,body)
select 'welcome', coalesce(title,'مرحبًا بك في حيّنا'), body from public.platform_messages
where recipient_id is null and type='welcome' order by created_at desc limit 1;
insert into public.platform_welcome_settings(id,title,body) values
('welcome','أهلًا بك في منصة حيّنا 👋','سعداء بانضمامك إلى مجتمع حيّنا. اكتشف جيرانك، شارك استفساراتك، وتابع السوق والبثوث. هنا تصلك أخبار المنصة وتحديثاتها من حسابنا الرسمي. للمساعدة، تواصل مع فريقنا عبر صفحة الدعم.') on conflict do nothing;

create table app_private.platform_welcome_receipts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  delivered_at timestamptz not null default now()
);
alter table app_private.platform_welcome_receipts enable row level security;
insert into app_private.platform_welcome_receipts(user_id)
select distinct recipient_id from public.platform_messages where type='welcome' and recipient_id is not null on conflict do nothing;

-- Internal trigger only: clients cannot impersonate the official account.
create function app_private.deliver_platform_welcome() returns trigger
language plpgsql security definer set search_path = '' as $$
declare template public.platform_welcome_settings%rowtype;
begin
  select * into template from public.platform_welcome_settings where id='welcome' and enabled;
  if not found then return new; end if;
  insert into app_private.platform_welcome_receipts(user_id) values(new.id) on conflict do nothing;
  if found then
    insert into public.platform_messages(recipient_id,sender_label,title,body,type)
    values(new.id,'منصة حيّنا',template.title,template.body,'welcome');
  end if;
  return new;
end $$;
revoke all on function app_private.deliver_platform_welcome() from public,anon,authenticated;
create trigger profile_automatic_platform_welcome after insert on public.profiles
for each row execute function app_private.deliver_platform_welcome();

create table public.platform_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  title text,
  body text not null,
  type text not null check(type in ('update','announcement','system')),
  audience text not null check(audience in ('all','new','user')),
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.platform_campaigns enable row level security;
create policy platform_campaign_admin_read on public.platform_campaigns for select to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and not is_banned));
grant select on public.platform_campaigns to authenticated;
alter table public.platform_messages add column campaign_id uuid references public.platform_campaigns(id);
create index platform_inbox_order_idx on public.platform_messages(recipient_id,created_at desc,id desc);
create index platform_unread_idx on public.platform_messages(recipient_id) where not read;
create unique index platform_campaign_recipient_idx on public.platform_messages(campaign_id,recipient_id) where campaign_id is not null;

create function public.send_platform_campaign(p_title text,p_body text,p_type text,p_audience text,p_username text default null,p_request_id uuid default gen_random_uuid())
returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); delivered integer; campaign uuid; existing public.platform_campaigns%rowtype;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin' and not is_banned) then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if p_request_id is null or p_body is null or length(btrim(p_body)) not between 1 and 5000 or length(coalesce(p_title,''))>160
     or p_type is null or p_type not in ('update','announcement','system') or p_audience is null or p_audience not in ('all','new','user') then
    raise exception 'Invalid message';
  end if;
  insert into public.platform_campaigns(id,created_by,title,body,type,audience)
  values(p_request_id,actor,nullif(btrim(p_title),''),btrim(p_body),p_type,p_audience)
  on conflict do nothing returning id into campaign;
  if campaign is null then
    select * into existing from public.platform_campaigns where id=p_request_id and created_by=actor;
    if not found then raise exception 'Request conflict'; end if;
    return existing.recipient_count;
  end if;
  insert into public.platform_messages(recipient_id,sender_label,title,body,type,campaign_id)
  select id,'منصة حيّنا',nullif(btrim(p_title),''),btrim(p_body),p_type,campaign from public.profiles
  where not is_banned and (p_audience='all' or (p_audience='new' and created_at>=now()-interval '7 days')
    or (p_audience='user' and lower(username)=lower(ltrim(btrim(p_username),'@'))));
  get diagnostics delivered=row_count;
  if delivered=0 then raise exception 'لا يوجد مستخدمون مطابقون للجمهور المحدد'; end if;
  update public.platform_campaigns set recipient_count=delivered where id=campaign;
  return delivered;
end $$;
revoke all on function public.send_platform_campaign(text,text,text,text,text,uuid) from public,anon;
grant execute on function public.send_platform_campaign(text,text,text,text,text,uuid) to authenticated;

create function public.platform_campaign_request_id() returns uuid
language sql volatile security invoker set search_path = '' as $$ select gen_random_uuid() $$;
revoke all on function public.platform_campaign_request_id() from public,anon;
grant execute on function public.platform_campaign_request_id() to authenticated;

-- A recipient can change the read flag, never the official message contents.
revoke update on public.platform_messages from authenticated;
grant update(read) on public.platform_messages to authenticated;

-- Publish only recipient-scoped inbox events; row access remains enforced by RLS.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='platform_messages') then
    alter publication supabase_realtime add table public.platform_messages;
  end if;
end $$;
