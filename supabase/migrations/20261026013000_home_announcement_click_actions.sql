alter table public.home_announcements add column if not exists action_type text not null default 'none';
alter table public.home_announcements add column if not exists action_target text;
alter table public.home_announcements add constraint home_announcement_action_valid check (
 (action_type='none' and action_target is null) or
 (action_type='external' and action_target ~* '^https://[^[:space:]]+$') or
 (action_type='internal' and action_target ~ '^/[a-zA-Z0-9/_-]+$')
);