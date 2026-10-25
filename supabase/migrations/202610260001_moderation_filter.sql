-- Moderation: banned words + violations
create table if not exists public.banned_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  enabled boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_violations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('question','product','message','request','comment')),
  content text not null,
  detected_word text,
  created_at timestamptz not null default now()
);

alter table public.banned_words enable row level security;
alter table public.moderation_violations enable row level security;

-- admins can manage banned_words
create policy "admins manage banned_words" on public.banned_words for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- admins can read violations
create policy "admins read violations" on public.moderation_violations for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- authenticated users can insert violations (for logging)
create policy "users insert violations" on public.moderation_violations for insert to authenticated
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.banned_words to authenticated;
grant select, insert on public.moderation_violations to authenticated;
