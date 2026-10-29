const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createDatabase, asUser } = require('./databaseHarness.cjs');
const owner = '10000000-0000-4000-8000-000000000001', stranger = '10000000-0000-4000-8000-000000000002';
test('business archive hides the public page, preserves the row and allows owner restoration', async () => {
 const db = await createDatabase({ schema: `create function public.hayna_is_staff(uuid) returns boolean language sql stable as $$select false$$;
 create table public.businesses(id uuid primary key default gen_random_uuid(),owner_id uuid,name text);alter table public.businesses enable row level security;
 create policy visible on public.businesses for select to anon,authenticated using(true);
 create policy owner_update on public.businesses for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
 grant select on public.businesses to anon,authenticated;grant update on public.businesses to authenticated;
 insert into public.businesses(owner_id,name)values('${owner}','متجر');`, migration: fs.readFileSync(path.join(__dirname,'../artifacts/business-archive.sql'),'utf8') });
 try {
  await asUser(db,owner);await db.exec('update public.businesses set archived_at=now()');assert.equal((await db.query('select * from public.businesses')).rows.length,1);
  await asUser(db,stranger);assert.equal((await db.query('select * from public.businesses')).rows.length,0);assert.equal((await db.query('update public.businesses set archived_at=null returning id')).rows.length,0);
  await asUser(db,'','anon');assert.equal((await db.query('select * from public.businesses')).rows.length,0);
  await asUser(db,owner);await db.exec('update public.businesses set archived_at=null');await asUser(db,stranger);assert.equal((await db.query('select * from public.businesses')).rows.length,1);
 }finally{await db.close();}
});
