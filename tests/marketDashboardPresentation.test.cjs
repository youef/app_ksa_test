const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const ts=require('typescript');
const file=require.resolve('../lib/marketDashboardPresentation.ts');
const m=new Module(file);
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {marketDashboardCount,marketDashboardHasAttention,marketDashboardAttentionLine}=m.exports;
test('counts use readable digits and do not fake missing data as zero',()=>{
 assert.equal(marketDashboardCount(0),'0');
 assert.equal(marketDashboardCount('2'),'2');
 assert.equal(marketDashboardCount(1234),'1,234');
 for(const input of [null,undefined,'',NaN,Infinity,-5,false,'not a number'])assert.equal(marketDashboardCount(input),'—');
});
test('actionable orders show only verified nonzero counts',()=>{
 assert.equal(marketDashboardHasAttention(null),false);
 assert.equal(marketDashboardHasAttention(0),false);
 assert.equal(marketDashboardHasAttention(2),true);
 assert.equal(marketDashboardAttentionLine(2,1),'2 طلب منتج ينتظر موافقتك · 1 طلب جاهز لاستلامك');
 assert.equal(marketDashboardAttentionLine(null,0),'');
});
