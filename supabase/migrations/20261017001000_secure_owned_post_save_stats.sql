create or replace function public.get_owned_post_save_count(p_target_type text, p_target_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_owner boolean := false;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_target_type = 'request' then
    select exists (
      select 1 from public.requests
      where id = p_target_id and requester_id = auth.uid()
    ) into v_is_owner;
  elsif p_target_type = 'question' then
    select exists (
      select 1 from public.questions
      where id = p_target_id and author_id = auth.uid()
    ) into v_is_owner;
  else
    raise exception 'Unsupported post type';
  end if;

  if not v_is_owner then
    raise exception 'Not authorized to view post statistics';
  end if;

  select count(*)::integer into v_count
  from public.favorite_items
  where target_type = p_target_type and target_id = p_target_id;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.get_owned_post_save_count(text, uuid) from public, anon;
grant execute on function public.get_owned_post_save_count(text, uuid) to authenticated;
