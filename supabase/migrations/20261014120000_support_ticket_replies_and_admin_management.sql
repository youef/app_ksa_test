-- Support ticket conversations and administrative CRUD.
create table if not exists public.support_ticket_replies (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null,
 author_name text not null default 'مستخدم',
 message text not null check(char_length(message) between 1 and 2000),
 is_admin boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists support_ticket_replies_ticket_idx on public.support_ticket_replies(ticket_id,created_at asc);
alter table public.support_ticket_replies enable row level security;
grant select,insert,update,delete on public.support_ticket_replies to authenticated;
drop policy if exists support_replies_read_participant on public.support_ticket_replies;
create policy support_replies_read_participant on public.support_ticket_replies for select to authenticated using(
 exists(select 1 from public.support_tickets t where t.id=ticket_id and
 (t.user_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')))
);
drop policy if exists support_replies_insert_participant on public.support_ticket_replies;
create policy support_replies_insert_participant on public.support_ticket_replies for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from public.support_tickets t where t.id=ticket_id and
 (t.user_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))) and
 is_admin=exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
);
drop policy if exists support_replies_update_admin on public.support_ticket_replies;
create policy support_replies_update_admin on public.support_ticket_replies for update to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists support_replies_delete_admin on public.support_ticket_replies;
create policy support_replies_delete_admin on public.support_ticket_replies for delete to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists tickets_admin_delete on public.support_tickets;
create policy tickets_admin_delete on public.support_tickets for delete to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists tickets_create_all on public.support_tickets;
drop policy if exists tickets_admin_insert_authenticated on public.support_tickets;
drop policy if exists tickets_create_authenticated on public.support_tickets;
drop policy if exists tickets_create_guest on public.support_tickets;
create policy tickets_create_guest on public.support_tickets for insert to anon with check(user_id is null);
create policy tickets_create_authenticated on public.support_tickets for insert to authenticated with check(user_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
