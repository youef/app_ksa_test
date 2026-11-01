const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createDatabase,asUser}=require('./databaseHarness.cjs');
const id=n=>`41000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('product enquiry lifecycle is atomic, private, versioned and restricted to the correct participant',async t=>{
 // Reuse the same two-role privacy fixture and real functions, without production rows.
 const source=fs.readFileSync('tests/neighborPrivacy.database.test.cjs','utf8');
 const template=source.match(/ const schema=`([\s\S]*?)`;\r?\n const db=/)[1];
 let schema=template.replace(/\$\{id\((\d+)\)\}/g,(_,n)=>id(Number(n)));
 schema+=`alter table messages add primary key(id);alter table messages add created_at timestamptz default now();alter table marketplace_items add updated_at timestamptz default now();
 create schema private;create function private.prohibited_story_word(p jsonb) returns text language sql as $$select case when p->>'content' like '%اختبار_مرفوض%' then 'اختبار_مرفوض' else null end$$;
 create function public.hayna_account_is_active(p uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles where id=p and not is_banned)$$;
 update profiles set account_type='merchant',is_verified=true,is_verified_merchant=true where id='${id(2)}';
 insert into marketplace_items(id,seller_id,title,price,description,status)values('${id(80)}','${id(2)}','منتج اختبار',50,E'وصف المنتج\\n\\nتفاصيل المنتج\\nالاستلام: استلام أو توصيل','available');`;
 const db=await createDatabase({schema,migration:['artifacts/neighbor-privacy.sql','artifacts/regional-product-visibility.sql','artifacts/product-request-workflow.sql']});t.after(()=>db.close());
 const create=async(request=id(81),quantity=1,price=50,note='')=>(await db.query('select hayna_create_product_request($1,$2,$3,$4,$5,$6) r',[request,id(80),quantity,note,'استلام من الموقع',price])).rows[0].r;
 const action=async(request,version,kind)=>(await db.query('select hayna_update_product_request($1,$2,$3) r',[request,version,kind])).rows[0].r;
 await t.test('create inserts one real request and message; retries return the same request',async()=>{
  await asUser(db,id(1));const first=await create();assert.equal(first.reused,false);assert.equal(first.request.status,'pending');assert.equal((await create()).reused,true);
  assert.equal((await db.query('select * from marketplace_product_requests')).rows.length,1);assert.equal((await db.query('select * from messages')).rows.length,1);
 });
 await t.test('server rejects stale price, invalid quantity, forbidden note and self-request',async()=>{
  await assert.rejects(create(id(82),1,49),/product_price_changed/);await assert.rejects(create(id(82),21),/invalid_product_request/);await assert.rejects(create(id(82),1,50,'اختبار_مرفوض'),/product_request_note_rejected/);
  await asUser(db,id(2));await assert.rejects(create(id(82)),/product_contact_restricted/);await asUser(db,id(1));
 });
 await t.test('buyer revisions are versioned and stale actions cannot overwrite them',async()=>{
  const result=(await db.query("select hayna_update_product_request($1,1,'revise',2,'اللون الأخضر','توصيل بالتنسيق',50) r",[id(81)])).rows[0].r;assert.equal(result.version,2);assert.equal(result.quantity,2);
  await assert.rejects(action(id(81),1,'cancel'),/product_request_stale/);await assert.rejects(action(id(81),2,'accept'),/product_request_forbidden/);
 });
 await t.test('seller acceptance reserves atomically; another pending request cannot reserve it',async()=>{
  await create(id(82));await asUser(db,id(2));assert.equal((await action(id(81),2,'accept')).status,'accepted');
  assert.equal((await db.query('select status from marketplace_items where id=$1',[id(80)])).rows[0].status,'reserved');
  await assert.rejects(db.query("update marketplace_items set status='available' where id=$1",[id(80)]),/product_reserved_by_request/);
  await assert.rejects(action(id(82),1,'accept'),/product_unavailable/);await assert.rejects(action(id(81),3,'complete'),/product_request_forbidden/);
 });
 await t.test('only seller marks ready and only buyer confirms receipt; terminal request cannot reopen',async()=>{
  assert.equal((await action(id(81),3,'ready')).status,'ready');await asUser(db,id(1));assert.equal((await action(id(81),4,'complete')).status,'completed');
  assert.equal((await db.query('select status from marketplace_items where id=$1',[id(80)])).rows[0].status,'sold');await assert.rejects(action(id(81),5,'cancel'),/product_request_closed/);
  assert.equal((await db.query('select * from marketplace_product_request_events where request_id=$1',[id(81)])).rows.length,5);
 });
 await t.test('legacy enquiry adoption keeps the existing message and is idempotent',async()=>{
  await asUser(db,id(1));const chat=(await db.query('select hayna_get_or_create_direct_conversation($1) id',[id(2)])).rows[0].id;
  await asUser(db,null,'service_role');await db.query("update marketplace_items set status='available' where id=$1",[id(80)]);
  await db.query('insert into messages(id,conversation_id,sender_id,body)values($1,$2,$3,$4)',[id(85),chat,id(1),'طلب منتج من سوق حيّنا\nhttps://appksatest.vercel.app/marketplace-item?id='+id(80)]);
  await asUser(db,id(1));const result=await create(id(85));assert.equal(result.request.message_id,id(85));assert.equal((await create(id(85))).reused,true);
  assert.equal((await db.query('select count(*)::int n from messages where id=$1',[id(85)])).rows[0].n,1);
 });
 await t.test('seller cannot accept a changed price until buyer explicitly reviews the fresh quote',async()=>{
  await asUser(db,id(1));await create(id(86));await asUser(db,id(2));await db.query('update marketplace_items set price=80 where id=$1',[id(80)]);
  await assert.rejects(action(id(86),1,'accept'),/product_price_changed/);
  await asUser(db,id(1));await db.query("select hayna_update_product_request($1,1,'revise',1,'','استلام من الموقع',80)",[id(86)]);
  await asUser(db,id(2));assert.equal((await action(id(86),2,'accept')).unit_price,80);
  await asUser(db,id(1));await action(id(86),3,'cancel');
  await asUser(db,null,'service_role');await db.query('update marketplace_items set price=50 where id=$1',[id(80)]);
 });
 await t.test('unrelated user cannot read request/history or forge transitions or direct writes',async()=>{
  await asUser(db,id(3));assert.equal((await db.query('select * from marketplace_product_requests')).rows.length,0);assert.equal((await db.query('select * from marketplace_product_request_events')).rows.length,0);
  await assert.rejects(action(id(81),5,'cancel'),/product_request_forbidden/);await assert.rejects(db.query("update marketplace_product_requests set status='completed'"),/permission denied/);
 });
 await t.test('cancellation releases this reservation, remains possible after blocking, and preserves history',async()=>{
  await asUser(db,null,'service_role');await db.query("update marketplace_items set status='available' where id=$1",[id(80)]);
  await asUser(db,id(1));await create(id(83));await asUser(db,id(2));await action(id(83),1,'accept');
  await asUser(db,null,'service_role');await db.query('insert into blocks values($1,$2)',[id(2),id(1)]);
  await asUser(db,id(1));assert.equal((await action(id(83),2,'cancel')).status,'cancelled');
  await asUser(db,null,'service_role');assert.equal((await db.query('select status from marketplace_items where id=$1',[id(80)])).rows[0].status,'available');
 });
 await t.test('anonymous access has neither tables nor workflow execution',async()=>{
  await asUser(db,null,'anon');await assert.rejects(db.query('select * from marketplace_product_requests'),/permission denied/);await assert.rejects(create(id(84)),/permission denied/);
 });
});
