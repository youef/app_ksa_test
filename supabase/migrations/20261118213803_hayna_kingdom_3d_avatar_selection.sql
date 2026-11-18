-- 3D world character choices saved per anonymous game captain.
alter table public.hayna_game_captains add column if not exists avatar_key text not null default 'knight';
alter table public.hayna_game_captains drop constraint if exists hayna_game_captains_avatar_key_check;
alter table public.hayna_game_captains add constraint hayna_game_captains_avatar_key_check check (
  avatar_key in ('knight','ranger','warrior','desert','captain','mage')
);

create or replace function public.hayna_game_set_avatar(p_avatar_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_key text := lower(coalesce(p_avatar_key,''));
begin
  if v_uid is null then raise exception 'سجّل الدخول لاختيار شخصيتك'; end if;
  if v_key not in ('knight','ranger','warrior','desert','captain','mage') then
    raise exception 'شخصية غير متاحة';
  end if;
  update public.hayna_game_captains set avatar_key = v_key where user_id = v_uid;
  if not found then raise exception 'أنشئ جزيرتك أولًا'; end if;
  return jsonb_build_object('saved',true,'avatar_key',v_key);
end;
$$;
revoke all on function public.hayna_game_set_avatar(text) from public, anon;
grant execute on function public.hayna_game_set_avatar(text) to authenticated;
