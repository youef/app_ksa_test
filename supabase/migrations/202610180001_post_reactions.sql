-- Community reactions for question/request cards.
-- One reaction per authenticated user per post; choosing another reaction replaces it.
create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('question', 'request')),
  target_id uuid not null,
  reaction_type text not null check (reaction_type in ('like', 'help', 'useful', 'thanks')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_reactions_one_per_user unique (target_type, target_id, user_id)
);

create index if not exists post_reactions_target_idx on public.post_reactions (target_type, target_id);
alter table public.post_reactions enable row level security;

drop policy if exists "Reactions are readable by authenticated users" on public.post_reactions;
create policy "Reactions are readable by authenticated users" on public.post_reactions for select to authenticated using (true);
drop policy if exists "Users can create their own reactions" on public.post_reactions;
create policy "Users can create their own reactions" on public.post_reactions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own reactions" on public.post_reactions;
create policy "Users can update their own reactions" on public.post_reactions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own reactions" on public.post_reactions;
create policy "Users can delete their own reactions" on public.post_reactions for delete to authenticated using (auth.uid() = user_id);
grant select, insert, update, delete on public.post_reactions to authenticated;
