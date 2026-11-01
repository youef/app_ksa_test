const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const file=require.resolve('../lib/productMessage.ts'),m=new Module(file);
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {productMessageId,productStatusLabel}=m.exports;
test('product card recognizes only product enquiries with a valid first-party product link',()=>{
 const id='20000000-0000-4000-8000-000000000001',body='طلب منتج من سوق حيّنا\nhttps://appksatest.vercel.app/marketplace-item?id='+id;
 assert.equal(productMessageId(body),id);
 for(const value of [body.replace('appksatest.vercel.app','evil.test'),body.replace(id,'../../other'),body.replace('طلب منتج من سوق حيّنا','نص عادي'),body.replace('/marketplace-item','/auth')])assert.equal(productMessageId(value),null);
});
test('product status distinguishes available, reserved and sold without inventing payment state',()=>{
 assert.equal(productStatusLabel('available'),'متاح');assert.equal(productStatusLabel('reserved'),'محجوز');assert.equal(productStatusLabel('sold'),'مباع');assert.equal(productStatusLabel('paid'),'غير متاح');
});
