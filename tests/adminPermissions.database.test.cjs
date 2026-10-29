const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, asUser } = require('./databaseHarness.cjs');
const OWNER='10000000-0000-0000-0000-000000000001', VERIFIER='10000000-0000-0000-0000-000000000002', MEMBER='10000000-0000-0000-0000-000000000003', BARE='10000000-0000-0000-0000-000000000004';
const schema=`
create table profiles(id uuid primary key, role text default 'user',is_banned boolean default false,is_verified boolean default false,is_verified_merchant boolean default false,is_geoverified boolean default false);
create table admin_roles(key text primary key,permissions jsonb not null default '{}');
create table admin_role_assignments(user_id uuid references profiles,role_key text references admin_roles,assigned_by uuid,created_at timestamptz default now(),primary key(user_id,role_key));
create table admin_permissions(admin_id uuid references profiles,permission text,enabled boolean default true,updated_at timestamptz default now(),primary key(admin_id,permission));
create table admin_activity_logs(id uuid primary key default gen_random_uuid(),actor_id uuid not null,action text not null,target_type text,target_id uuid,metadata jsonb not null default '{}',created_at timestamptz default now());
create table app_config(key text primary key,value jsonb);
alter table profiles enable row level security; create policy profiles_read on profiles for select using(true);
create policy profiles_legacy_update on profiles for update using(true) with check(true);
alter table app_config enable row level security; create policy config_read on app_config for select using(true);create policy config_old on app_config for all using(exists(select 1 from profiles where id=auth.uid() and role='admin'));
grant all on all tables in schema public to anon,authenticated;
insert into profiles(id,role) values('${OWNER}','admin'),('${VERIFIER}','admin'),('${MEMBER}','user'),('${BARE}','admin');
insert into admin_roles values('owner','{"all":true}'),('verifier','{"verifications":true,"users":true}');
insert into admin_role_assignments(user_id,role_key) values('${OWNER}','owner'),('${VERIFIER}','verifier');
insert into app_config values('page_backgrounds','{}');
`;
test('RBAC uses existing explicit roles, rejects escalation, protects last owner and append-only audit',async()=>{
 const db=await createDatabase({schema,migration:'artifacts/integration-rbac.sql'});
 try {
  for(const id of [MEMBER,BARE]){await asUser(db,id);assert.equal((await db.query("select hayna_has_permission('roles') ok")).rows[0].ok,false);await assert.rejects(db.query('select hayna_assign_admin_role($1,$2,true)',[id,'owner']),/permission_denied/);}
  await asUser(db,VERIFIER);assert.equal((await db.query("select hayna_has_permission('verifications') ok")).rows[0].ok,true);assert.equal((await db.query("select hayna_has_permission('analytics') ok")).rows[0].ok,false);
  await assert.rejects(db.query("insert into admin_role_assignments(user_id,role_key) values($1,'owner')",[VERIFIER]),/permission denied/);
  await assert.rejects(db.query("update profiles set role='admin' where id=$1",[MEMBER]),/permission_denied:roles/);
  assert.equal((await db.query("update app_config set value='{}' returning key")).rows.length,0);
  await asUser(db,OWNER);assert.equal((await db.query("select hayna_has_permission('roles') ok")).rows[0].ok,true);
  await assert.rejects(db.query("select hayna_assign_admin_role($1,'owner',false)",[OWNER]),/last_owner/);
  await assert.rejects(db.query("update profiles set is_banned=true where id=$1",[OWNER]),/last_owner/);
  await db.query("select hayna_set_admin_permission($1,'analytics',true)",[VERIFIER]);
  await asUser(db,VERIFIER);assert.equal((await db.query("select hayna_has_permission('analytics') ok")).rows[0].ok,true);
  await asUser(db,OWNER);await db.query("select hayna_set_admin_permission($1,'verifications',false)",[VERIFIER]);
  await asUser(db,VERIFIER);assert.equal((await db.query("select hayna_has_permission('verifications') ok")).rows[0].ok,false);
  await assert.rejects(db.query("update profiles set is_verified=true where id=$1",[MEMBER]),/permission_denied:verifications/);
  await assert.rejects(db.query('truncate admin_permissions'),/permission denied/);
  await asUser(db,OWNER);assert.ok((await db.query('select count(*)::int c from admin_activity_logs')).rows[0].c>=2);
  await assert.rejects(db.query('delete from admin_activity_logs'),/permission denied/);
  await asUser(db,null,'anon');assert.equal((await db.query("select hayna_has_permission('users') ok")).rows[0].ok,false);
 } finally {await db.close();}
});
