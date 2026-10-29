const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const file=require.resolve('../lib/campaignDraft.ts'),m=new Module(file);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {readCampaignDraft}=m.exports;
test('local promotion drafts only restore approved available service and package references',()=>{
 const draft={version:1,title:'عرض الحي',description:'تفاصيل',serviceId:'own-service',packageSlug:'week',updatedAt:10};
 assert.equal(readCampaignDraft(JSON.stringify(draft),['own-service'],['week']).serviceId,'own-service');
 const stale=readCampaignDraft(JSON.stringify(draft),[],[]);assert.equal(stale.serviceId,'');assert.equal(stale.packageSlug,'');
});
test('corrupt, oversized and incompatible local drafts fail closed',()=>{
 for(const raw of [null,'not-json','[]',JSON.stringify({version:9}),JSON.stringify({version:1,title:'x'.repeat(101),description:'',updatedAt:1})])assert.equal(readCampaignDraft(raw,[],[]),null);
});
