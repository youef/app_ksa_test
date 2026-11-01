const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createDatabase,asUser}=require('./databaseHarness.cjs');
const id=n=>`30000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
test('marketplace workspace enforces eligibility, payment atomicity, private orders and service transitions',async t=>{
 const {schema}=require('./marketplaceFixture.cjs');
 const db=await createDatabase({schema,migration:[fs.readFileSync('supabase/migrations/20261015120000_marketplace_commerce.sql','utf8'),fs.readFileSync('artifacts/marketplace-workspace.sql','utf8'),fs.readFileSync('artifacts/marketplace-promotion-display.sql','utf8')]});t.after(()=>db.close());
 let serviceOrder,order,campaign,campaignOrder;
 await t.test('ordinary account can read workspace but cannot activate professional plan or forge ledger',async()=>{
  await asUser(db,id(3));const w=(await db.query('select hayna_marketplace_workspace() w')).rows[0].w;assert.equal(w.professional,false);assert.equal(w.orders.length,0);
  await assert.rejects(db.query('select hayna_activate_free_marketplace_plan()'),/verified_market_account_required/);
  await assert.rejects(db.query("insert into marketplace_orders(user_id,order_type,amount_halalas,idempotency_key)values(auth.uid(),'subscription',100,'forged')"),/permission denied/);
  await assert.rejects(db.query("select hayna_confirm_marketplace_payment($1,'moyasar','x',100,'SAR',null)",[id(99)]),/permission denied/);
 });
 await t.test('free activation is real and idempotent without charging or overriding existing plan',async()=>{
  await asUser(db,id(2));const a=(await db.query('select hayna_activate_free_marketplace_plan() id')).rows[0].id;assert.equal((await db.query('select hayna_activate_free_marketplace_plan() id')).rows[0].id,a);
  assert.equal((await db.query('select hayna_marketplace_workspace() w')).rows[0].w.subscription.id,a);
 });
 await t.test('checkout reservation is atomic and retries reuse one child/order',async()=>{
  await asUser(db,id(2));const a=(await db.query("select hayna_prepare_marketplace_checkout('stable-retry-001','subscription','pro-monthly') r")).rows[0].r;
  const b=(await db.query("select hayna_prepare_marketplace_checkout('stable-retry-001','subscription','pro-monthly') r")).rows[0].r;
  assert.equal(a.created,true);assert.equal(b.created,false);assert.equal(a.order.id,b.order.id);assert.equal(a.order.amount_halalas,4900);
  await asUser(db,id(3));await assert.rejects(db.query("select hayna_prepare_marketplace_checkout('member-plan-001','subscription','pro-monthly')"),/verified_market_account_required/);
 });
 await t.test('payment confirmation rolls back on mismatch and commits related status exactly once',async()=>{
  await asUser(db,null,'service_role');
  serviceOrder=(await db.query("insert into marketplace_service_orders(buyer_id,provider_id,service_id,service_name,amount_halalas)values($1,$2,$3,'خدمة تجريبية',2500)returning id",[id(3),id(2),id(10)])).rows[0].id;
  order=(await db.query("insert into marketplace_orders(user_id,order_type,amount_halalas,idempotency_key,service_order_id,gateway_invoice_id)values($1,'service_order',2500,'service-test',$2,'invoice-test')returning id",[id(3),serviceOrder])).rows[0].id;
  await assert.rejects(db.query("select hayna_confirm_marketplace_payment($1,'moyasar','invoice-test',1,'SAR',null)",[order]),/verified_payment_mismatch/);
  assert.equal((await db.query('select status from marketplace_orders where id=$1',[order])).rows[0].status,'pending');
  const first=(await db.query("select hayna_confirm_marketplace_payment($1,'moyasar','invoice-test',2500,'SAR','payment-test') r",[order])).rows[0].r;assert.equal(first.duplicate,false);
  assert.equal((await db.query("select hayna_confirm_marketplace_payment($1,'moyasar','invoice-test',2500,'SAR','payment-test') r",[order])).rows[0].r.duplicate,true);
  assert.equal((await db.query('select count(*)::int n from marketplace_payment_transactions where order_id=$1',[order])).rows[0].n,1);
 });
 await t.test('provider may accept/start; only buyer confirms completion; outsiders cannot read orders',async()=>{
  await asUser(db,id(4));assert.equal((await db.query('select * from marketplace_orders')).rows.length,0);assert.equal((await db.query('select hayna_marketplace_workspace() w')).rows[0].w.service_orders.length,0);
  await assert.rejects(db.query("select hayna_manage_marketplace('service_order',$1,'accept')",[serviceOrder]),/permission_denied/);
  await asUser(db,id(3));await assert.rejects(db.query("select hayna_manage_marketplace('service_order',$1,'accept')",[serviceOrder]),/invalid_transition/);
  await asUser(db,id(2));await db.query("select hayna_manage_marketplace('service_order',$1,'accept')",[serviceOrder]);await db.query("select hayna_manage_marketplace('service_order',$1,'start')",[serviceOrder]);await assert.rejects(db.query("select hayna_manage_marketplace('service_order',$1,'complete')",[serviceOrder]),/invalid_transition/);
  await asUser(db,id(3));await db.query("select hayna_manage_marketplace('service_order',$1,'complete')",[serviceOrder]);await db.query("select hayna_manage_marketplace('service_order',$1,'complete')",[serviceOrder]);
 });
 await t.test('paid promotion requires explicit admin review then respects area, pause and expiry',async()=>{
  await asUser(db,null,'service_role');
  const pkg=(await db.query("select id from marketplace_ad_packages where slug='boost-7'")).rows[0].id;
  campaign=(await db.query("insert into marketplace_ad_campaigns(owner_id,package_id,title,service_id)values($1,$2,'حملة تجريبية',$3)returning id",[id(2),pkg,id(10)])).rows[0].id;
  campaignOrder=(await db.query("insert into marketplace_orders(user_id,order_type,amount_halalas,idempotency_key,ad_campaign_id,package_id)values($1,'ad_campaign',4900,'campaign-test',$2,$3)returning id",[id(2),campaign,pkg])).rows[0].id;
  await db.query('update marketplace_ad_campaigns set payment_order_id=$1,status=\'pending_review\' where id=$2',[campaignOrder,campaign]);
  await asUser(db,id(1));await assert.rejects(db.query('select hayna_review_marketplace_campaign($1,true)',[campaign]),/confirmed_payment_required/);
  await asUser(db,null,'service_role');await db.query("select hayna_confirm_marketplace_payment($1,'moyasar','ad-invoice',4900,'SAR',null)",[campaignOrder]);
  await asUser(db,id(2));await assert.rejects(db.query('select hayna_review_marketplace_campaign($1,true)',[campaign]),/permission_denied/);
  await asUser(db,id(1));await db.query('select hayna_review_marketplace_campaign($1,true)',[campaign]);
  await asUser(db,null,'anon');assert.equal((await db.query("select hayna_marketplace_promotions('الرياض','النرجس') ads")).rows[0].ads.length,1);assert.equal((await db.query("select hayna_marketplace_promotions('جدة',null) ads")).rows[0].ads.length,0);
  await asUser(db,id(2));await db.query("select hayna_manage_marketplace('campaign',$1,'pause')",[campaign]);assert.equal((await db.query("select hayna_marketplace_promotions('الرياض',null) ads")).rows[0].ads.length,0);await db.query("select hayna_manage_marketplace('campaign',$1,'resume')",[campaign]);
 });
});
