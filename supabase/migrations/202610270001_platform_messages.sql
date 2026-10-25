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
