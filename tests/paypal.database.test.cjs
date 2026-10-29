const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createDatabase,asUser}=require('./databaseHarness.cjs');
const {schema}=require('./marketplaceFixture.cjs');
const id=n=>`30000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
test('PayPal quotes and confirmed USD settlement preserve SAR contracts and existing eligibility',async t=>{
 const db=await createDatabase({schema,migration:['supabase/migrations/20261015120000_marketplace_commerce.sql','artifacts/marketplace-workspace.sql','artifacts/marketplace-promotion-display.sql','artifacts/marketplace-paypal.sql']});t.after(()=>db.close());let order,q;
 await t.test('ordinary user cannot create a professional subscription',async()=>{await asUser(db,id(3));await assert.rejects(db.query("select hayna_prepare_paypal_checkout('paypal-ineligible','subscription','pro-monthly')"),/verified_market_account_required/);});
 await t.test('eligible checkout delegates server pricing and reuses one reservation',async()=>{await asUser(db,id(2));const a=(await db.query("select hayna_prepare_paypal_checkout('paypal-retry-001','subscription','pro-monthly') r")).rows[0].r;order=a.order;assert.equal(order.gateway,'paypal');assert.equal(order.amount_halalas,4900);assert.equal((await db.query("select hayna_prepare_paypal_checkout('paypal-retry-001','subscription','pro-monthly') r")).rows[0].r.created,false);});
 await t.test('client cannot set quotes, bind a provider order, confirm or refund',async()=>{
  for(const sql of ["select hayna_quote_paypal($1,3750000,'sandbox','MERCHANT123')","select hayna_bind_paypal($1,gen_random_uuid(),'ORDER12345','https://www.sandbox.paypal.com/checkoutnow?token=ORDER12345')","select hayna_confirm_paypal($1,'ORDER12345','CAPTURE12345',1307,'MERCHANT123','sandbox')","select hayna_refund_paypal($1,'CAPTURE12345')"]){await assert.rejects(db.query(sql,[order.id]),/permission denied/);}
  await assert.rejects(db.query("update marketplace_orders set paypal_quote='{}' where id=$1",[order.id]),/permission denied/);
 });
 await t.test('USD amount is rounded exactly once and the first quote stays immutable',async()=>{await asUser(db,null,'service_role');q=(await db.query("select hayna_quote_paypal($1,3750000,'sandbox','MERCHANT123') q",[order.id])).rows[0].q;assert.equal(q.amount_minor,1307);assert.equal(q.source_amount_minor,4900);const retry=(await db.query("select hayna_quote_paypal($1,4000000,'live','OTHER12345') q",[order.id])).rows[0].q;assert.deepEqual(retry,q);});
 await t.test('incorrect quote and provider rebinding fail',async()=>{
  await assert.rejects(db.query("select hayna_bind_paypal($1,gen_random_uuid(),'ORDER12345','https://www.sandbox.paypal.com/checkoutnow?token=ORDER12345')",[order.id]),/paypal_binding_mismatch/);
  await db.query("select hayna_bind_paypal($1,$2,'ORDER12345','https://www.sandbox.paypal.com/checkoutnow?token=ORDER12345')",[order.id,q.id]);
  await assert.rejects(db.query("select hayna_bind_paypal($1,$2,'ORDER54321','https://www.sandbox.paypal.com/checkoutnow?token=ORDER54321')",[order.id,q.id]),/paypal_binding_mismatch/);
 });
 await t.test('wrong amount, merchant and environment cannot activate entitlement',async()=>{
  for(const [amount,merchant,env]of [[1308,'MERCHANT123','sandbox'],[1307,'OTHER12345','sandbox'],[1307,'MERCHANT123','live']])await assert.rejects(db.query("select hayna_confirm_paypal($1,'ORDER12345','CAPTURE12345',$2,$3,$4)",[order.id,amount,merchant,env]),/paypal_verified_payment_mismatch/);
  assert.equal((await db.query('select status from marketplace_orders where id=$1',[order.id])).rows[0].status,'pending');
 });
 await t.test('confirmation commits exactly once and records actual USD separately',async()=>{
  const a=(await db.query("select hayna_confirm_paypal($1,'ORDER12345','CAPTURE12345',1307,'MERCHANT123','sandbox') r",[order.id])).rows[0].r;assert.equal(a.duplicate,false);
  assert.equal((await db.query("select hayna_confirm_paypal($1,'ORDER12345','CAPTURE12345',1307,'MERCHANT123','sandbox') r",[order.id])).rows[0].r.duplicate,true);
  const rows=(await db.query('select * from marketplace_payment_transactions where order_id=$1',[order.id])).rows;assert.equal(rows.length,1);assert.equal(Number(rows[0].amount_halalas),4900);assert.equal(rows[0].gateway_payload.capture_currency,'USD');assert.equal(rows[0].gateway_payload.capture_amount_minor,1307);
 });
 await t.test('verified full refund revokes the matching subscription and never reactivates',async()=>{
  await db.query("select hayna_refund_paypal($1,'CAPTURE12345')",[order.id]);await db.query("select hayna_refund_paypal($1,'CAPTURE12345')",[order.id]);
  assert.equal((await db.query('select status from marketplace_subscriptions where id=$1',[order.subscription_id])).rows[0].status,'cancelled');
  await assert.rejects(db.query("select hayna_confirm_paypal($1,'ORDER12345','CAPTURE12345',1307,'MERCHANT123','sandbox')",[order.id]),/refunded_order_cannot_reactivate/);
 });
 await t.test('outsiders cannot read the quote or payment record',async()=>{await asUser(db,id(4));assert.equal((await db.query('select * from marketplace_orders where id=$1',[order.id])).rows.length,0);});
});
