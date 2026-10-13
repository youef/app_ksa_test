-- Enforce the two-edit limit at the database boundary for all user listings.
-- The client may display remaining edits, but cannot reset or bypass the counter.
create or replace function public.enforce_user_listing_edit_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
  content_changed boolean := false;
begin
  if tg_table_name = 'questions' then
    content_changed := old_row -> 'title' is distinct from new_row -> 'title'
      or old_row -> 'content' is distinct from new_row -> 'content'
      or old_row -> 'body' is distinct from new_row -> 'body';
  elsif tg_table_name = 'requests' then
    content_changed := old_row -> 'title' is distinct from new_row -> 'title'
      or old_row -> 'description' is distinct from new_row -> 'description'
      or old_row -> 'notes' is distinct from new_row -> 'notes';
  elsif tg_table_name = 'urgent_alerts' then
    content_changed := old_row -> 'title' is distinct from new_row -> 'title'
      or old_row -> 'description' is distinct from new_row -> 'description';
  elsif tg_table_name = 'services' then
    content_changed := old_row -> 'name' is distinct from new_row -> 'name'
      or old_row -> 'description' is distinct from new_row -> 'description';
  end if;

  if content_changed then
    if coalesce((old_row ->> 'edit_count')::integer, 0) >= 2 then
      raise exception using errcode = 'check_violation', message = 'EDIT_LIMIT_REACHED';
    end if;
    new.edit_count := coalesce((old_row ->> 'edit_count')::integer, 0) + 1;
  else
    -- Status, location, counters, and operational updates do not consume edits.
    new.edit_count := coalesce((old_row ->> 'edit_count')::integer, 0);
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_question_edit_limit on public.questions;
create trigger enforce_question_edit_limit before update on public.questions
for each row execute function public.enforce_user_listing_edit_limit();

drop trigger if exists enforce_request_edit_limit on public.requests;
create trigger enforce_request_edit_limit before update on public.requests
for each row execute function public.enforce_user_listing_edit_limit();

drop trigger if exists enforce_urgent_alert_edit_limit on public.urgent_alerts;
create trigger enforce_urgent_alert_edit_limit before update on public.urgent_alerts
for each row execute function public.enforce_user_listing_edit_limit();

drop trigger if exists enforce_service_edit_limit on public.services;
create trigger enforce_service_edit_limit before update on public.services
for each row execute function public.enforce_user_listing_edit_limit();

notify pgrst, 'reload schema';
