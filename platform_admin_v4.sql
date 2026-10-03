-- Platform resource administration v4
-- All actions are guarded by the database-backed admin role.

create or replace function public.admin_update_platform_entity(
  p_entity text,
  p_target_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_actor is null or not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_entity = 'business' and p_action = 'toggle_verified' then
    update public.businesses set is_verified = not coalesce(is_verified, false), updated_at = now() where id = p_target_id returning to_jsonb(businesses.*) into v_result;
  elsif p_entity = 'marketplace' and p_action in ('archive', 'restore') then
    update public.marketplace_items set status = case when p_action = 'archive' then 'archived' else 'available' end, updated_at = now() where id = p_target_id returning to_jsonb(marketplace_items.*) into v_result;
  elsif p_entity = 'event' and p_action in ('publish', 'cancel') then
    update public.events set status = case when p_action = 'publish' then 'published' else 'cancelled' end where id = p_target_id returning to_jsonb(events.*) into v_result;
  else
    raise exception 'unsupported platform entity action';
  end if;
  if v_result is null then raise exception 'platform entity not found'; end if;
  insert into public.admin_activity_logs(actor_id, action, target_type, target_id, metadata)
  values (v_actor, 'تحديث مورد من موارد المنصة', p_entity, p_target_id, jsonb_build_object('action', p_action));
  return v_result;
end;
$$;

revoke all on function public.admin_update_platform_entity(text, uuid, text) from public, anon;
grant execute on function public.admin_update_platform_entity(text, uuid, text) to authenticated;
