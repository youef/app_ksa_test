-- Run through an administrative connection. Every fixture is rolled back.
begin;
create temp table contact_qa_ids on commit drop as
select id, row_number() over(order by id) as n from public.profiles
where role = 'user' and not is_banned order by id limit 2;
grant select on contact_qa_ids to anon, authenticated;
do $$ begin
  if (select count(*) from contact_qa_ids) <> 2 then raise exception 'Contact QA needs two existing profiles'; end if;
end $$;
delete from public.profile_contact_numbers where user_id in (select id from contact_qa_ids);
delete from public.blocks where blocker_id in (select id from contact_qa_ids) and blocked_id in (select id from contact_qa_ids);
update public.profiles set profile_privacy = 'public', hide_name = false where id in (select id from contact_qa_ids);

select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from contact_qa_ids where n=1),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub', (select id::text from contact_qa_ids where n=1),true);
set local role authenticated;
insert into public.profile_contact_numbers(user_id,phone) values(auth.uid(),'+15555550101');
do $$ begin
  if (select count(*) from public.profile_contact_numbers where user_id=auth.uid() and not is_visible) <> 1 then raise exception 'Owner cannot read hidden contact'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  if exists(select 1 from public.profile_contact_numbers where user_id=(select id from contact_qa_ids where n=1)) then raise exception 'Guest can read hidden contact'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from contact_qa_ids where n=2),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub', (select id::text from contact_qa_ids where n=2),true);
set local role authenticated;
do $$ declare affected integer; denied boolean:=false; begin
  if exists(select 1 from public.profile_contact_numbers where user_id=(select id from contact_qa_ids where n=1)) then raise exception 'Other member can read hidden contact'; end if;
  update public.profile_contact_numbers set phone='+15555550102' where user_id=(select id from contact_qa_ids where n=1);
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Other member can update contact'; end if;
  delete from public.profile_contact_numbers where user_id=(select id from contact_qa_ids where n=1);
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Other member can delete contact'; end if;
  begin
    insert into public.profile_contact_numbers(user_id,phone) values((select id from contact_qa_ids where n=1),'+15555550102');
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Other member can insert owner contact'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from contact_qa_ids where n=1),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub', (select id::text from contact_qa_ids where n=1),true);
set local role authenticated;
insert into public.profile_contact_numbers(user_id,phone,is_visible) values(auth.uid(),'+15555550101',true)
on conflict(user_id) do update set phone=excluded.phone,is_visible=excluded.is_visible;
reset role;
select set_config('request.jwt.claims','{}',true);
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
  if (select count(*) from public.profile_contact_numbers where user_id=(select id from contact_qa_ids where n=1)) <> 1 then raise exception 'Visible public contact missing'; end if;
end $$;
reset role;

update public.profiles set profile_privacy='private' where id=(select id from contact_qa_ids where n=1);
set local role anon;
do $$ begin
  if exists(select 1 from public.profile_contact_numbers where user_id=(select id from contact_qa_ids where n=1)) then raise exception 'Private account exposes contact'; end if;
end $$;
reset role;
update public.profiles set profile_privacy='public',hide_name=true where id=(select id from contact_qa_ids where n=1);
set local role anon;
do $$ begin
  if exists(select 1 from public.profile_contact_numbers where user_id=(select id from contact_qa_ids where n=1)) then raise exception 'Anonymous account exposes contact'; end if;
end $$;
reset role;
update public.profiles set hide_name=false where id=(select id from contact_qa_ids where n=1);
insert into public.blocks(blocker_id,blocked_id) select a.id,b.id from contact_qa_ids a cross join contact_qa_ids b where a.n=1 and b.n=2;
select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from contact_qa_ids where n=2),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub', (select id::text from contact_qa_ids where n=2),true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.profile_contact_numbers where user_id=(select id from contact_qa_ids where n=1)) then raise exception 'Blocked viewer can read contact'; end if;
end $$;
reset role;
delete from public.blocks where blocker_id in (select id from contact_qa_ids) and blocked_id in (select id from contact_qa_ids);
insert into public.blocks(blocker_id,blocked_id) select a.id,b.id from contact_qa_ids a cross join contact_qa_ids b where a.n=2 and b.n=1;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.profile_contact_numbers where user_id=(select id from contact_qa_ids where n=1)) then raise exception 'Blocking viewer can read contact'; end if;
end $$;
reset role;

do $$ begin
  if has_column_privilege('anon','public.profiles','phone','SELECT') or has_column_privilege('authenticated','public.profiles','phone','SELECT') then raise exception 'Legacy phone is readable'; end if;
  if has_column_privilege('anon','public.profiles','totp_secret','SELECT') or has_column_privilege('authenticated','public.profiles','national_address_code','SELECT') then raise exception 'Private profile field readable'; end if;
  if not has_column_privilege('authenticated','public.profiles','display_name','SELECT') then raise exception 'Public profile read broken'; end if;
end $$;
select 'PASS: owner access, hidden/public/private contacts, blocked viewers, unauthorized writes, legacy fields' as result;
rollback;
