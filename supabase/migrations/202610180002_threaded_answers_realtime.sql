-- Threaded answer management, ownership policies, and realtime delivery.
-- Existing answer creation continues through hayna_create_question_answer RPC.

alter table public.answers enable row level security;

drop policy if exists "Authors can update own answers" on public.answers;
create policy "Authors can update own answers"
  on public.answers for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "Authors can delete own answers" on public.answers;
create policy "Authors can delete own answers"
  on public.answers for delete to authenticated
  using (auth.uid() = author_id);

grant update, delete on public.answers to authenticated;

-- Preserve replies to a deleted parent by detaching them before the parent row is removed.
create or replace function public.hayna_detach_child_answers_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.answers
     set parent_answer_id = null
   where parent_answer_id = old.id;
  return old;
end;
$$;

drop trigger if exists answers_detach_children_before_delete on public.answers;
create trigger answers_detach_children_before_delete
before delete on public.answers
for each row execute function public.hayna_detach_child_answers_before_delete();

-- Supabase Realtime only publishes tables that are members of supabase_realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'answers'
    ) then
      alter publication supabase_realtime add table public.answers;
    end if;
    if to_regclass('public.notifications') is not null and not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end;
$$;
