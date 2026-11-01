const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createDatabase,asUser}=require('./databaseHarness.cjs');
const id=n=>`41000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('neighbor profile scope and direct-message preferences are enforced by PostgreSQL',async t=>{
 const schema=`
 create table profiles(id uuid primary key,username text,city text,district text,region text default 'الرياض',hide_name boolean default false,is_banned boolean default false,profile_privacy text default 'public',allow_dms text default 'everyone');
 create table blocks(blocker_id uuid,blocked_id uuid);create table follows(follower_id uuid,following_id uuid);
 create table admin_permissions(admin_id uuid,permission text,enabled boolean);create table admin_roles(key text,permissions jsonb);create table admin_role_assignments(user_id uuid,role_key text);
 create table conversations(id uuid primary key default gen_random_uuid(),created_by uuid,created_at timestamptz default now());
 create table conversation_members(conversation_id uuid,user_id uuid,primary key(conversation_id,user_id));
 create table messages(id uuid default gen_random_uuid(),conversation_id uuid,sender_id uuid,body text);
 create table profile_contact_numbers(user_id uuid,phone text,is_visible boolean default true);
 create table profile_customizations(user_id uuid,accent_color text);
 alter table profiles enable row level security;create policy legacy_public on profiles for select using(true);
 alter table messages enable row level security;
 alter table profile_contact_numbers enable row level security;create policy visible_phone on profile_contact_numbers for select using(is_visible or user_id=auth.uid());
 alter table profile_customizations enable row level security;create policy legacy_design on profile_customizations for select using(true);
 grant select on profiles,profile_contact_numbers,profile_customizations to anon,authenticated;grant insert,select,update on messages to authenticated;
 create policy "messages authenticated read allowed conversation" on messages for select to authenticated using(true);
 create policy legacy_message_update on messages for update to authenticated using(sender_id=auth.uid());
 insert into auth.users(id)values('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}'),('${id(5)}');
 insert into profiles(id,username,city,district)values('${id(1)}','viewer','الرياض','النرجس'),('${id(2)}','neighbor','مدينة الرياض','حي النرجس'),('${id(3)}','other_hood','الرياض','الملقا'),('${id(4)}','other_city','جدة','النرجس'),('${id(5)}','staff','جدة','الروضة');
 insert into profile_contact_numbers values('${id(2)}','0500000000',true);insert into profile_customizations values('${id(4)}','#000000');
 insert into admin_roles values('users_manager','{"users":true}');insert into admin_role_assignments values('${id(5)}','users_manager');
 grant all on all tables in schema public to service_role;
 `;
 const db=await createDatabase({schema,migration:fs.readFileSync('artifacts/neighbor-privacy.sql','utf8')});t.after(()=>db.close());
 await db.exec(`create policy allowed_message on messages for insert to authenticated with check(sender_id=auth.uid() and public.hayna_can_message_conversation(conversation_id,auth.uid()));`);
 let conversation;
 await t.test('matching city and district labels in another region do not expose profiles or enable DMs',async()=>{
  await asUser(db,null,'service_role');
  await db.query("insert into profiles(id,username,city,district,region)values($1,'same_name_other_region','الرياض','النرجس','المدينة المنورة')",[id(6)]);
  await asUser(db,id(1));
  assert.equal((await db.query('select * from profiles where id=$1',[id(6)])).rows.length,0);
  assert.equal((await db.query('select hayna_neighbor_access($1) r',[id(6)])).rows[0].r.can_view,false);
  assert.equal((await db.query('select hayna_can_dm($1,$2) ok',[id(1),id(6)])).rows[0].ok,false);
 });
 await t.test('different cities cannot read profiles even with old SELECT true policies',async()=>{
  await asUser(db,id(1));assert.equal((await db.query('select * from profiles where id=$1',[id(4)])).rows.length,0);
  assert.equal((await db.query('select * from profile_customizations')).rows.length,0);
  assert.equal((await db.query('select * from profiles where id=$1',[id(1)])).rows.length,1);
 });
 await t.test('district and city scopes use viewer location on the server, not caller coordinates',async()=>{
  const access=async(scope)=>(await db.query('select hayna_neighbor_access($1,$2) r',[id(3),scope])).rows[0].r;
  assert.equal((await access('district')).can_view,false);assert.equal((await access('district')).target_id,null);
  assert.equal((await access('city')).can_view,true);assert.equal((await access('city')).can_message,false);
  assert.equal((await db.query('select hayna_neighbor_access($1) r',['neighbor'])).rows[0].r.can_message,true);
  await assert.rejects(access('kingdom'),/invalid_neighbor_scope/);
 });
 await t.test('same-district conversation creation is idempotent and sending works',async()=>{
  conversation=(await db.query('select hayna_get_or_create_direct_conversation($1) id',[id(2)])).rows[0].id;
  assert.equal((await db.query('select hayna_get_or_create_direct_conversation($1) id',[id(2)])).rows[0].id,conversation);
  await db.query('insert into messages(conversation_id,sender_id,body)values($1,$2,$3)',[conversation,id(1),'اختبار معزول']);
  await assert.rejects(db.query('select hayna_get_or_create_direct_conversation($1)',[id(3)]),/dm_not_allowed/);
 });
 await t.test('editing an existing message cannot move it into an unauthorized conversation',async()=>{
  await asUser(db,null,'service_role');const foreign=(await db.query('insert into conversations(created_by)values($1)returning id',[id(4)])).rows[0].id;
  await db.query('insert into conversation_members values($1,$2),($1,$3)',[foreign,id(1),id(4)]);
  await asUser(db,id(1));await assert.rejects(db.query('update messages set conversation_id=$1 where sender_id=$2',[foreign,id(1)]),/row.level security/);
 });
 await t.test('closing DMs hides phone and prevents sending into an existing conversation',async()=>{
  await asUser(db,null,'service_role');await db.query("update profiles set allow_dms='nobody' where id=$1",[id(2)]);
  await asUser(db,id(1));assert.equal((await db.query('select * from profile_contact_numbers')).rows.length,0);
  assert.equal((await db.query('select hayna_neighbor_access($1) r',[id(2)])).rows[0].r.can_message,false);
  assert.equal((await db.query('select * from messages where conversation_id=$1',[conversation])).rows.length,1);
  await assert.rejects(db.query('insert into messages(conversation_id,sender_id,body)values($1,$2,$3)',[conversation,id(1),'مرفوض']),/row.level security/);
 });
 await t.test('followers, blocks and hidden profiles remain effective',async()=>{
  await asUser(db,null,'service_role');await db.query("update profiles set allow_dms='followers' where id=$1",[id(2)]);
  await asUser(db,id(1));assert.equal((await db.query('select hayna_can_dm($1,$2) ok',[id(1),id(2)])).rows[0].ok,false);
  await asUser(db,null,'service_role');await db.query('insert into follows values($1,$2)',[id(1),id(2)]);
  await asUser(db,id(1));assert.equal((await db.query('select hayna_can_dm($1,$2) ok',[id(1),id(2)])).rows[0].ok,true);
  await asUser(db,null,'service_role');await db.query('insert into blocks values($1,$2)',[id(2),id(1)]);
  await asUser(db,id(1));assert.equal((await db.query('select * from profiles where id=$1',[id(2)])).rows.length,0);
 });
 await t.test('explicit user-administration permission permits review but not cross-district messaging',async()=>{
  await asUser(db,id(5));assert.equal((await db.query('select * from profiles where id=$1',[id(1)])).rows.length,1);
  assert.equal((await db.query('select hayna_neighbor_access($1) r',[id(1)])).rows[0].r.can_view,false);
  assert.equal((await db.query('select hayna_can_dm($1,$2) ok',[id(5),id(1)])).rows[0].ok,false);
  await asUser(db,null,'service_role');await db.query("insert into admin_permissions values($1,'users',false)",[id(5)]);
  await asUser(db,id(5));assert.equal((await db.query('select * from profiles where id=$1',[id(1)])).rows.length,0);
 });
 await t.test('anonymous reads and forged sender arguments fail closed',async()=>{
  await asUser(db,id(1));assert.equal((await db.query('select hayna_can_dm($1,$2) ok',[id(2),id(1)])).rows[0].ok,false);
  await asUser(db,null,'anon');assert.equal((await db.query('select * from profiles')).rows.length,0);
  assert.equal((await db.query('select hayna_neighbor_access($1) r',[id(1)])).rows[0].r.can_view,false);
 });
});
