begin;
do $$
declare
  admin_id uuid;
  member_id uuid;
  before_value jsonb;
  after_value jsonb;
  affected integer;
begin
  select id into admin_id from public.profiles where role='admin' and not coalesce(is_banned,false) limit 1;
  select id into member_id from public.profiles where role<>'admin' and not coalesce(is_banned,false) limit 1;
  if admin_id is null or member_id is null then raise exception 'Existing role fixtures required'; end if;
  select value into before_value from public.app_config where key='page_backgrounds';
  perform set_config('request.jwt.claims', jsonb_build_object('sub',admin_id,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  after_value := public.hayna_set_page_background('app',null,0.33,0.18);
  if after_value->'app'->>'lightOpacity' <> '0.33' then raise exception 'Admin update failed'; end if;
  if after_value->'welcome' is distinct from before_value->'welcome' or after_value->'login' is distinct from before_value->'login' then raise exception 'Another slot was overwritten'; end if;
  begin
    perform public.hayna_set_page_background('invalid',null,0.3,0.2);
    raise exception 'Invalid slot accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.hayna_set_page_background('app','https://example.com/file.png',0.3,0.2);
    raise exception 'External URL accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.hayna_set_page_background('app','backgrounds/missing.png',0.3,0.2);
    raise exception 'Missing image accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.hayna_set_page_background('app',null,0,1.1);
    raise exception 'Invalid opacity accepted';
  exception when invalid_parameter_value then null; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', jsonb_build_object('sub',member_id,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.hayna_set_page_background('app',null,0.3,0.2);
    raise exception 'Member changed backgrounds';
  exception when insufficient_privilege then null; end;
  update public.app_config set value='{}' where key='page_backgrounds';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Member bypassed configuration RLS'; end if;
  begin
    execute 'truncate public.app_config';
    raise exception 'Member bypassed RLS through truncate';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  perform set_config('request.jwt.claims','{}',true);
  execute 'set local role anon';
  if not exists(select 1 from public.app_config where key='page_backgrounds') then raise exception 'Guest cannot read public background settings'; end if;
  begin
    perform public.hayna_set_page_background('app',null,0.3,0.2);
    raise exception 'Guest executed admin function';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end;
$$;
rollback;
select 'PASS: admin updates; independent slots; invalid path, image and opacity rejection; member and guest denial; truncate denial; public reads. All changes rolled back.' as verification;
