const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const ts=require('typescript');
const file=require.resolve('../lib/productOrdersPresentation.ts');
const m=new Module(file);
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {productOrderIsClosed,productOrderNeedsAttention,productOrderAudienceLabel,productOrderAudienceHint,productOrderStageIndex,prioritizeProductOrders}=m.exports;

test('finished and cancelled orders are separated from active requests',()=>{
 for(const status of ['completed','cancelled','rejected'])assert.equal(productOrderIsClosed(status),true);
 for(const status of ['pending','accepted','ready'])assert.equal(productOrderIsClosed(status),false);
});
test('only the appropriate side sees a needs-attention state',()=>{
 assert.equal(productOrderNeedsAttention('pending','incoming'),true);
 assert.equal(productOrderNeedsAttention('pending','outgoing'),false);
 assert.equal(productOrderNeedsAttention('ready','outgoing'),true);
 assert.equal(productOrderNeedsAttention('ready','incoming'),false);
 assert.equal(productOrderAudienceLabel('pending','outgoing'),'بانتظار التاجر');
 assert.equal(productOrderAudienceLabel('pending','incoming'),'طلب جديد');
 assert.match(productOrderAudienceHint('ready','outgoing'),/الاستلام/);
 assert.equal(productOrderStageIndex('cancelled'),-1);
 assert.equal(productOrderStageIndex('completed'),3);
});
test('sort active attention first and preserve latest within the same priority',()=>{
 const rows=[
 {id:'older',status:'accepted',created_at:'2026-11-10T12:00:00Z'},
 {id:'done',status:'completed',created_at:'2026-11-18T12:00:00Z'},
 {id:'needs',status:'pending',created_at:'2026-11-02T12:00:00Z'},
 {id:'newer',status:'accepted',created_at:'2026-11-17T12:00:00Z'}
 ];
 assert.deepEqual(prioritizeProductOrders(rows,'incoming').map(x=>x.id),['needs','newer','older','done']);
 assert.deepEqual(rows.map(x=>x.id),['older','done','needs','newer']);
});
