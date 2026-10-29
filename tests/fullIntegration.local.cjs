// Optional metadata-snapshot integration run. Snapshot stays ignored locally.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {integrationDatabase}=require('./integrationSchema.cjs');
const {asUser}=require('./databaseHarness.cjs');
async function run(){
 const db=await integrationDatabase();
 try{
  await db.exec('set check_function_bodies=true');
  if(process.env.MARKETPLACE_QA)await db.exec(fs.readFileSync('supabase/migrations/20261015120000_marketplace_commerce.sql','utf8'));
  for(const file of ['integration-rbac.sql','integration-commerce.sql','integration-community.sql','integration-analytics.sql','integration-rbac-extra.sql']){
   const name='artifacts/'+file;if(!fs.existsSync(name))continue;
   try{await db.exec(fs.readFileSync(name,'utf8'));console.log('Applied isolated:',file);}catch(error){throw new Error(file+': '+error.message);}
  }
  if(process.env.MARKETPLACE_QA)await db.exec(fs.readFileSync('artifacts/marketplace-workspace.sql','utf8'));
  await db.exec(`insert into auth.users(id) values('20000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002'),('20000000-0000-0000-0000-000000000003');
   insert into profiles(id,username,display_name,role,city,district,account_type,is_verified,is_verified_merchant) values
   ('20000000-0000-0000-0000-000000000001','qa_owner','مالك تجريبي','admin','الرياض','النرجس','standard',false,false),
   ('20000000-0000-0000-0000-000000000002','qa_member','عضو تجريبي','user','الرياض','النرجس','standard',false,false),
   ('20000000-0000-0000-0000-000000000003','qa_merchant','تاجر تجريبي','user','الرياض','النرجس','merchant',true,true);
   insert into admin_roles(key,label,permissions) values('owner','مالك المنصة','{"all":true}') on conflict(key) do nothing;
   insert into admin_role_assignments(user_id,role_key) values('20000000-0000-0000-0000-000000000001','owner');`);
  await asUser(db,'20000000-0000-0000-0000-000000000002');
  assert.equal((await db.query("select hayna_has_permission('roles') ok")).rows[0].ok,false);
  assert.equal((await db.query('select hayna_my_account_capabilities() caps')).rows[0].caps.can_publish_products,false);
  await assert.rejects(db.query("insert into marketplace_items(seller_id,title,description,price,city,district) values(auth.uid(),'منتج فحص','وصف المنتج التجريبي',50,'جدة','الروضة')"));
  await asUser(db,'20000000-0000-0000-0000-000000000003');
  const business=(await db.query('select hayna_ensure_my_business() id')).rows[0].id;assert.ok(business);
  const product=(await db.query("insert into marketplace_items(seller_id,title,description,price,city,district) values(auth.uid(),'منتج فحص','وصف المنتج التجريبي',50,'جدة','الروضة') returning city,district,business_id")).rows[0];
  assert.equal(product.city,'الرياض');assert.equal(product.district,'النرجس');assert.equal(product.business_id,business);
  await asUser(db,'20000000-0000-0000-0000-000000000001');
  assert.equal((await db.query("select hayna_has_permission('analytics') ok")).rows[0].ok,true);
  const dashboard=(await db.query('select hayna_analytics_dashboard(7) result')).rows[0].result;assert.equal(dashboard.revenue_available,Boolean(process.env.MARKETPLACE_QA));
  console.log('Combined existing triggers + new migrations: PASS; market scope, eligibility, business binding, RBAC and analytics RPC verified.');
 }finally{await db.close();}
}
run().catch(error=>{console.error(error.message,error.where||'');process.exitCode=1});
