create schema if not exists app_private;

alter table public.profiles
  add column if not exists username_last_changed_at timestamptz;

create or replace function app_private.enforce_username_change_window()
returns trigger
language plpgsql
set search_path = public, app_private, pg_catalog
as $$
begin
  if new.username_last_changed_at is distinct from old.username_last_changed_at
     and current_setting('app.username_change_authorized', true) is distinct from 'true' then
    raise exception 'username_change_must_use_rpc';
  end if;

  if new.username is distinct from old.username then
    if current_setting('app.username_change_authorized', true) is distinct from 'true' then
      raise exception 'username_change_must_use_rpc';
    end if;

    if old.username_last_changed_at is not null
       and now() < old.username_last_changed_at + interval '1 month' then
      raise exception 'username_change_cooldown';
    end if;

    new.username_last_changed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_username_change_window on public.profiles;
create trigger enforce_username_change_window
before update on public.profiles
for each row execute function app_private.enforce_username_change_window();

create or replace function public.change_my_username(p_username text)
returns timestamptz
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_username text := lower(trim(p_username));
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_username !~ '^[a-zA-Z0-9_]{3,30}$' then
    raise exception 'invalid_username';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if v_profile.username = v_username then
    return v_profile.username_last_changed_at;
  end if;

  if v_profile.username_last_changed_at is not null
     and now() < v_profile.username_last_changed_at + interval '1 month' then
    raise exception 'username_change_cooldown';
  end if;

  if exists (
    select 1 from public.profiles
    where username = v_username and id <> v_uid
  ) then
    raise exception 'username_taken';
  end if;

  perform set_config('app.username_change_authorized', 'true', true);
  update public.profiles
  set username = v_username, updated_at = now()
  where id = v_uid;

  return now();
exception
  when unique_violation then
    raise exception 'username_taken';
end;
$$;

revoke all on function public.change_my_username(text) from public, anon;
grant execute on function public.change_my_username(text) to authenticated;
