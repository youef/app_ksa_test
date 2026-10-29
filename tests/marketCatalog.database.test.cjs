const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, asUser } = require('./databaseHarness.cjs');
const fs = require('node:fs');
const path = require('node:path');
const USER = '10000000-0000-4000-8000-000000000001';
test('market scope uses the authenticated account and respects table RLS', async t => {
  const db = await createDatabase({ schema: `
    create table public.profiles(id uuid primary key,city text,district text,region text,is_banned boolean default false);
    alter table public.profiles enable row level security;
    create policy self on public.profiles for select to authenticated using(id=auth.uid());
    create table public.marketplace_items(id uuid primary key default gen_random_uuid(),seller_id uuid,provider_id uuid,owner_id uuid,organizer_id uuid,city text,district text,status text default 'available',moderation_status text default 'approved',created_at timestamptz default now(),latitude float8,longitude float8);
    create table public.services(like public.marketplace_items including all);
    create table public.businesses(like public.marketplace_items including all);
    create table public.events(like public.marketplace_items including all);
    grant select on all tables in schema public to authenticated;
    alter table public.marketplace_items enable row level security;
    create policy visible on public.marketplace_items for select to authenticated using(status='available');
    insert into public.profiles values('${USER}','عرعر','النخيل','الحدود الشمالية',false);
    insert into public.profiles values('10000000-0000-4000-8000-000000000003','رفحاء','النخيل','الحدود الشمالية',false),('10000000-0000-4000-8000-000000000004','الرياض','النخيل','الرياض',false),('10000000-0000-4000-8000-000000000005','عرعر','النخيل','المدينة المنورة',false);
    insert into public.marketplace_items(seller_id,city,district,latitude,longitude) values('${USER}','عرعر','النخيل',30,40),('${USER}','عرعر','الروضة',30,40),('10000000-0000-4000-8000-000000000003','رفحاء','النخيل',30,40),('10000000-0000-4000-8000-000000000004','الرياض','النخيل',30,40),('10000000-0000-4000-8000-000000000005','عرعر','النخيل',30,40);
  `, migration: fs.readFileSync(path.join(__dirname, '../artifacts/market-catalog-page.sql'), 'utf8') });
  const call = async (scope, page = 0) => (await db.query('select public.hayna_market_catalog_page($1,$2,$3) result', ['products', scope, page])).rows[0].result;
  try {
    await asUser(db, USER);
    await t.test('district and whole-city scopes are exact, without personal data or coordinates', async () => {
      const district = await call('district'); assert.equal(district.rows.length, 1); assert.equal(district.rows[0].city, 'عرعر');
      assert.equal('latitude' in district.rows[0], false); assert.equal('longitude' in district.rows[0], false);
      assert.equal((await call('city')).rows.length, 2);
    });
    await t.test('region includes another city in the account region and excludes other regions', async () => {
      const response = await call('region'); assert.equal(response.rows.length, 3);
      assert.ok(response.rows.some(row => row.city === 'رفحاء')); assert.ok(response.rows.every(row => row.city !== 'الرياض'));
      assert.ok(response.rows.every(row => row.region === 'الحدود الشمالية'));
    });
    await t.test('source whitelist, scope whitelist and page bounds reject forged requests', async () => {
      await assert.rejects(db.query("select public.hayna_market_catalog_page('profiles','city',0)"), /invalid_market_source/);
      await assert.rejects(call('kingdom'), /invalid_market_scope/); await assert.rejects(call('city', -1), /invalid_market_scope/);
    });
    await t.test('stable pagination uses a sentinel and never duplicates the prior page', async () => {
      await db.exec('reset role'); await db.exec("insert into public.marketplace_items(seller_id,city,district,created_at) select '" + USER + "','عرعر','النخيل',now()-make_interval(mins=>n) from generate_series(1,65)n"); await asUser(db, USER);
      const first = await call('city'), second = await call('city', 1);
      assert.equal(first.rows.length, 60); assert.equal(first.has_more, true); assert.equal(second.rows.length, 7); assert.equal(second.has_more, false);
      assert.ok(second.rows.every(row => !first.rows.some(old => old.id === row.id)));
    });
    await t.test('publisher-supplied region is replaced with the matching account region', async () => {
      await db.exec('reset role');
      const row = await db.query("insert into public.marketplace_items(seller_id,city,district,region) values($1,'عرعر','النخيل','الرياض') returning region", [USER]);
      assert.equal(row.rows[0].region, 'الحدود الشمالية');
      const unknown = await db.query("insert into public.marketplace_items(seller_id,city,district,region) values($1,'مدينة أخرى','النخيل','الرياض') returning region", [USER]);
      assert.equal(unknown.rows[0].region, null);
      await asUser(db, USER);
    });
    await t.test('unknown identity and anonymous callers cannot browse unbounded regions', async () => {
      await asUser(db, '10000000-0000-4000-8000-000000000002'); await assert.rejects(call('region'), /account_location_required/);
      await asUser(db, '', 'anon'); await assert.rejects(call('region'), /permission denied/);
    });
  } finally { await db.close(); }
});
