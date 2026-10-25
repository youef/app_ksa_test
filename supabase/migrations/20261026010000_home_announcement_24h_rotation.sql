create table if not exists public.home_announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 120),
 message text not null check (char_length(message) between 1 and 1000),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '24 hours'),
 created_by uuid not null default auth.uid() references auth.users(id),
 constraint announcement_max_duration check (expires_at <= created_at + interval '24 hours' and expires_at > created_at)
);
create index if not exists home_announcements_expiry_idx on public.home_announcements (expires_at);
alter table public.home_announcements enable row level security;
revoke all on public.home_announcements from anon,authenticated;
grant select on public.home_announcements to anon,authenticated;
grant insert,update,delete on public.home_announcements to authenticated;
create policy "everyone reads active announcements" on public.home_announcements for select to anon,authenticated using (expires_at > now());
create policy "admins create announcements" on public.home_announcements for insert to authenticated with check (created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "admins remove announcements" on public.home_announcements for delete to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "admins edit announcements" on public.home_announcements for update to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create or replace function public.hayna_home_announcement_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' then
   new.created_at:=old.created_at;
   new.created_by:=old.created_by;
 end if;
 new.expires_at:=least(coalesce(new.expires_at,new.created_at+interval '24 hours'),new.created_at+interval '24 hours');
 return new;
end $$;
create trigger home_announcement_guard before insert or update on public.home_announcements for each row execute function public.hayna_home_announcement_guard();