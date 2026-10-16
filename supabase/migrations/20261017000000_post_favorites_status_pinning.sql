alter table public.requests
  add column if not exists resolution_status text not null default 'open',
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

alter table public.questions
  add column if not exists resolution_status text not null default 'open',
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

alter table public.favorite_items
  drop constraint if exists favorite_items_target_type_check;
alter table public.favorite_items
  add constraint favorite_items_target_type_check
  check (target_type = any (array['service','product','request','store','post','question']));

create index if not exists requests_pinned_profile_idx
  on public.requests (requester_id, is_pinned desc, created_at desc);
create index if not exists questions_pinned_profile_idx
  on public.questions (author_id, is_pinned desc, created_at desc);

alter table public.requests
  drop constraint if exists requests_resolution_status_check;
alter table public.requests
  add constraint requests_resolution_status_check
  check (resolution_status = any (array['open','found','helped','resolved','not_needed']));

alter table public.questions
  drop constraint if exists questions_resolution_status_check;
alter table public.questions
  add constraint questions_resolution_status_check
  check (resolution_status = any (array['open','found','helped','resolved','not_needed']));
