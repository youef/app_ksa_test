const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const file=require.resolve('../lib/marketplaceWorkspace.ts'),m=new Module(file);
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {safeMarketplaceCheckout,marketplaceMoney,marketplaceError}=m.exports;
test('only HTTPS provider checkout URLs open; malicious hosts and embedded credentials fail',()=>{
 for(const url of ['https://api.moyasar.com/v1/invoices/test','https://checkout.tap.company/test'])assert.equal(safeMarketplaceCheckout(url),url);
 for(const url of ['javascript:alert(1)','http://api.moyasar.com/x','https://moyasar.com.attacker.example/x','https://user:secret@api.moyasar.com/x','https://example.com/x',null])assert.equal(safeMarketplaceCheckout(url),null);
});
test('amounts use halalas and permission/transition failures have understandable Arabic messages',()=>{
 assert.ok(marketplaceMoney(4900).includes('٤٩'));
 assert.match(marketplaceError({message:'verified_market_account_required'}),/المهنية المعتمدة/);
 assert.match(marketplaceError({message:'invalid_transition'}),/حدّث/);
});
test('PayPal approval links are restricted to checkoutnow on exact approved hosts',()=>{
 for(const host of ['www.paypal.com','www.sandbox.paypal.com'])assert.ok(safeMarketplaceCheckout('https://'+host+'/checkoutnow?token=ORDER12345'));
 for(const url of ['https://paypal.com.attacker.example/checkoutnow?token=ORDER12345','https://www.paypal.com/login','https://www.paypal.com/checkoutnow?token=bad!','https://www.paypal.com:444/checkoutnow?token=ORDER12345'])assert.equal(safeMarketplaceCheckout(url),null);
});
