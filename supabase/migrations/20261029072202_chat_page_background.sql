-- Preserve the current chat appearance, then allow it to be managed independently.
update public.app_config
set value = jsonb_set(value, '{chat}', coalesce(value->'app', '{"path":null,"lightOpacity":0.27,"darkOpacity":0.16}'::jsonb), true)
where key = 'page_backgrounds' and not (value ? 'chat');
create or replace function public.hayna_set_page_background(
  p_slot text, p_path text, p_light_opacity numeric, p_dark_opacity numeric
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare next_value jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_slot is null or p_slot not in ('welcome','login','app','chat') then
    raise exception 'Invalid background slot' using errcode = '22023';
  end if;
  if p_light_opacity is null or p_dark_opacity is null
     or p_light_opacity not between 0.05 and 1 or p_dark_opacity not between 0.05 and 1 then
    raise exception 'Invalid background opacity' using errcode = '22023';
  end if;
  if p_path is not null then
    if p_path !~ '^backgrounds/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif)$' then
      raise exception 'Invalid background path' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'branding' and name = p_path
      and metadata->>'mimetype' in ('image/png','image/jpeg','image/webp','image/gif')
      and coalesce((metadata->>'size')::bigint, 0) between 1 and 5242880) then
      raise exception 'Upload a supported image smaller than 5 MB first' using errcode = '22023';
    end if;
  end if;
  insert into public.app_config(key,value,description)
    values ('page_backgrounds','{}','خلفيات صفحات المنصة') on conflict (key) do nothing;
  update public.app_config set
    value = jsonb_set(value, array[p_slot], jsonb_build_object('path',p_path,'lightOpacity',p_light_opacity,'darkOpacity',p_dark_opacity), true),
    updated_by = auth.uid(), updated_at = now()
  where key = 'page_backgrounds' returning value into next_value;
  if next_value is null then raise exception 'Background update was not saved'; end if;
  return next_value;
end;
$$;
revoke all on function public.hayna_set_page_background(text,text,numeric,numeric) from public, anon;
grant execute on function public.hayna_set_page_background(text,text,numeric,numeric) to authenticated;


