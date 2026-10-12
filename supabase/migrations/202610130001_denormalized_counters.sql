-- ============================================================
-- Denormalized counters on profiles for fast admin reads
-- ============================================================
alter table public.profiles
  add column if not exists notifications_unread_count int not null default 0,
  add column if not exists services_count int not null default 0,
  add column if not exists requests_count int not null default 0,
  add column if not exists reports_count int not null default 0,
  add column if not exists questions_count int not null default 0,
  add column if not exists answers_count int not null default 0;

-- Helper: safely increment/decrement a counter
create or replace function public.increment_counter(
  p_table text,
  p_pk_column text,
  p_pk_value uuid,
  p_counter_column text,
  p_delta int
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format('update %I set %I = greatest(%I + %L, 0) where %I = %L',
    p_table, p_counter_column, p_counter_column, p_delta, p_pk_column, p_pk_value);
end;
$$;

-- ============================================================
-- Triggers for notifications
-- ============================================================
create or replace function public.tg_notifications_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.increment_counter('profiles', 'id', NEW.user_id, 'notifications_unread_count', 1);
  elsif (TG_OP = 'UPDATE' and OLD.read_at is null and NEW.read_at is not null) then
    perform public.increment_counter('profiles', 'id', NEW.user_id, 'notifications_unread_count', -1);
  elsif (TG_OP = 'DELETE') then
    perform public.increment_counter('profiles', 'id', OLD.user_id, 'notifications_unread_count', -1);
  end if;
  return null;
end;
$$;

drop trigger if exists tg_notifications_counters on public.notifications;
create trigger tg_notifications_counters
after insert or update or delete on public.notifications
for each row execute function public.tg_notifications_counters();

-- ============================================================
-- Triggers for services
-- ============================================================
create or replace function public.tg_services_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.increment_counter('profiles', 'id', NEW.provider_id, 'services_count', 1);
  elsif (TG_OP = 'DELETE') then
    perform public.increment_counter('profiles', 'id', OLD.provider_id, 'services_count', -1);
  end if;
  return null;
end;
$$;

drop trigger if exists tg_services_counters on public.services;
create trigger tg_services_counters
after insert or delete on public.services
for each row execute function public.tg_services_counters();

-- ============================================================
-- Triggers for requests
-- ============================================================
create or replace function public.tg_requests_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.increment_counter('profiles', 'id', NEW.requester_id, 'requests_count', 1);
  elsif (TG_OP = 'DELETE') then
    perform public.increment_counter('profiles', 'id', OLD.requester_id, 'requests_count', -1);
  end if;
  return null;
end;
$$;

drop trigger if exists tg_requests_counters on public.requests;
create trigger tg_requests_counters
after insert or delete on public.requests
for each row execute function public.tg_requests_counters();

-- ============================================================
-- Triggers for reports
-- ============================================================
create or replace function public.tg_reports_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.increment_counter('profiles', 'id', NEW.target_id, 'reports_count', 1);
  elsif (TG_OP = 'DELETE') then
    perform public.increment_counter('profiles', 'id', OLD.target_id, 'reports_count', -1);
  end if;
  return null;
end;
$$;

drop trigger if exists tg_reports_counters on public.reports;
create trigger tg_reports_counters
after insert or delete on public.reports
for each row execute function public.tg_reports_counters();

-- ============================================================
-- Triggers for questions/answers
-- ============================================================
create or replace function public.tg_questions_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.increment_counter('profiles', 'id', NEW.author_id, 'questions_count', 1);
  elsif (TG_OP = 'DELETE') then
    perform public.increment_counter('profiles', 'id', OLD.author_id, 'questions_count', -1);
  end if;
  return null;
end;
$$;

drop trigger if exists tg_questions_counters on public.questions;
create trigger tg_questions_counters
after insert or delete on public.questions
for each row execute function public.tg_questions_counters();

create or replace function public.tg_answers_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    perform public.increment_counter('profiles', 'id', NEW.author_id, 'answers_count', 1);
  elsif (TG_OP = 'DELETE') then
    perform public.increment_counter('profiles', 'id', OLD.author_id, 'answers_count', -1);
  end if;
  return null;
end;
$$;

drop trigger if exists tg_answers_counters on public.answers;
create trigger tg_answers_counters
after insert or delete on public.answers
for each row execute function public.tg_answers_counters();

-- ============================================================
-- Backfill existing counts (run once after migration)
-- ============================================================
do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    update public.profiles set
      notifications_unread_count = (select count(*) from public.notifications where user_id = r.id and read_at is null),
      services_count = (select count(*) from public.services where provider_id = r.id),
      requests_count = (select count(*) from public.requests where requester_id = r.id),
      reports_count = (select count(*) from public.reports where target_id = r.id),
      questions_count = (select count(*) from public.questions where author_id = r.id),
      answers_count = (select count(*) from public.answers where author_id = r.id)
    where id = r.id;
  end loop;
end;
$$;