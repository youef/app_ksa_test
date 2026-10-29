const test=require('node:test'),assert=require('node:assert/strict');
const {createDatabase,asUser}=require('./databaseHarness.cjs');
const OWNER='10000000-0000-4000-8000-000000000001',USERS='10000000-0000-4000-8000-000000000002',MEMBER='10000000-0000-4000-8000-000000000003',BARE='10000000-0000-4000-8000-000000000004';
const schema=`
create table profiles(id uuid primary key,username text,display_name text,avatar_url text,role text default 'user',is_banned boolean default false,is_verified boolean default false,is_verified_merchant boolean default false,is_geoverified boolean default false,verification_status text,updated_at timestamptz default now(),phone text,national_address_code text,totp_secret text,totp_enabled boolean default false,admin_session_expires_at timestamptz,failed_login_attempts integer default 0,last_failed_login_at timestamptz,password_changed_at timestamptz);
create table admin_roles(key text primary key,permissions jsonb not null default '{}');
create table admin_role_assignments(user_id uuid references profiles,role_key text references admin_roles,assigned_by uuid,primary key(user_id,role_key));
create table admin_permissions(admin_id uuid references profiles,permission text,enabled boolean default true,updated_at timestamptz default now(),primary key(admin_id,permission));
create table admin_activity_logs(id uuid default gen_random_uuid(),actor_id uuid,action text,target_type text,target_id uuid,metadata jsonb);
create table app_config(key text,value jsonb);
alter table profiles enable row level security;create policy profiles_read on profiles for select using(true);create policy profiles_update on profiles for update using(true) with check(true);
grant all on all tables in schema public to anon,authenticated;
insert into profiles(id,role,totp_secret,phone) values('${OWNER}','admin','private-test-placeholder','private-test-phone'),('${USERS}','admin',null,null),('${MEMBER}','user',null,null),('${BARE}','admin',null,null);
insert into admin_roles values('owner','{"all":true}'),('manager','{"users":true}');insert into admin_role_assignments(user_id,role_key)values('${OWNER}','owner'),('${USERS}','manager');
create function public.assert_is_admin() returns void language plpgsql as $$begin if not exists(select 1 from profiles where id=auth.uid() and role='admin')then raise exception 'legacy_role';end if;end$$;
create function public.admin_enable_2fa(p_user_id uuid,p_secret text)returns void language plpgsql security definer as $$begin perform public.assert_is_admin();update profiles set totp_enabled=true where id=p_user_id;end$$;
create function public.admin_update_platform_entity(p_entity text,p_target_id uuid,p_action text)returns jsonb language plpgsql security definer as $$declare v_actor uuid:=auth.uid();begin perform public.assert_is_admin();if v_actor is null or not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then raise exception 'admin access required' using errcode = '42501';end if;return jsonb_build_object('ok',true);end$$;
`;
let db;
test.before(async()=>{db=await createDatabase({schema,migration:['artifacts/integration-rbac.sql','artifacts/integration-rbac-extra.sql']});});
test.after(async()=>{if(db)await db.close();});
test('private profile columns are unreadable even by an assigned owner through direct table access',async()=>{
 for(const role of ['anon','authenticated']){
  await asUser(db,OWNER,role);
  for(const column of ['totp_secret','phone','national_address_code','failed_login_attempts'])await assert.rejects(db.query(`select ${column} from profiles`),/permission denied/);
  assert.equal((await db.query('select id,display_name from profiles')).rows.length,4);
  await assert.rejects(db.query('truncate profiles'),/permission denied/);
 }
});
test('specific permissions guard legacy RPCs and a bare admin role confers no security or market access',async()=>{
 for(const id of [USERS,BARE,MEMBER]){
  await asUser(db,id);
  await assert.rejects(db.query('select admin_enable_2fa($1,$2)',[MEMBER,'placeholder']),/permission_denied:security/);
  await assert.rejects(db.query("select admin_update_platform_entity('service',$1,'toggle_available')",[MEMBER]),/permission_denied:entity/);
  await assert.rejects(db.query('select hayna_admin_security_profiles()'),/permission_denied:security/);
 }
 await asUser(db,OWNER);
 assert.ok(Array.isArray((await db.query('select hayna_admin_security_profiles() profiles')).rows[0].profiles));
 assert.equal(JSON.stringify((await db.query('select hayna_admin_security_profiles() profiles')).rows).includes('private-test-placeholder'),false);
 await db.query("select admin_update_platform_entity('service',$1,'toggle_available')",[MEMBER]);
});
test('user managers cannot change roles or verification, owner role changes preserve last-owner protection and redact returned records',async()=>{
 await asUser(db,USERS);
 await assert.rejects(db.query("select hayna_admin_set_profile_role($1,'admin')",[MEMBER]),/permission_denied:roles/);
 await assert.rejects(db.query("select admin_update_user($1,'admin',false,false,false)",[MEMBER]),/permission_denied:roles/);
 await assert.rejects(db.query("select admin_update_user($1,'user',true,false,false)",[MEMBER]),/permission_denied:verifications/);
 await asUser(db,OWNER);
 await assert.rejects(db.query("select hayna_admin_set_profile_role($1,'user')",[OWNER]),/last_owner/);
 await db.query("select hayna_admin_set_profile_role($1,'moderator')",[MEMBER]);
 const row=(await db.query("select to_jsonb(admin_update_user($1,'admin',false,false,false)) profile",[USERS])).rows[0].profile;
 assert.equal(row.totp_secret,null);assert.equal(row.phone,null);
 assert.equal((await db.query('select count(*)::int n from admin_activity_logs')).rows[0].n>0,true);
});
