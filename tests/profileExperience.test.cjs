const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const path=require.resolve('../lib/profileExperience.ts'),m=new Module(path);
m._compile(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,path);
const {publicProfileType,publicProfileVerification,publicProfileRoleCopy,profileActivityOrder,profileStartingTab,profileOwnerLinks}=m.exports;
test('types change public presentation without granting privileges',()=>{
 for(const kind of ['merchant','freelance','provider','idea'])assert.equal(publicProfileType({account_type:kind}),kind);
 assert.equal(publicProfileType({account_type:'unknown'}),'standard');
 assert.equal(publicProfileType({role:'admin',account_type:'merchant'}),'admin');
 assert.equal(publicProfileRoleCopy({account_type:'freelance',freelance_trade:'تصميم'}).professional,'تصميم');
 assert.deepEqual(profileOwnerLinks(undefined),[]);
 assert.deepEqual(profileOwnerLinks({can_publish_products:true,can_manage_business:false,can_promote:true}),['products','promotion']);
});
test('verification is based on approved status, never on account type or merchant flag',()=>{
 assert.equal(publicProfileVerification({account_type:'merchant',is_verified_merchant:true}).state,'unverified');
 assert.equal(publicProfileVerification({account_type:'freelance',verification_status:'pending'},true).state,'pending');
 assert.equal(publicProfileVerification({account_type:'freelance',verification_status:'pending'},false).state,'unverified');
 assert.equal(publicProfileVerification({is_verified:true,verification_status:'pending'}).state,'verified');
 assert.equal(publicProfileVerification({role:'admin'}).state,'official');
 assert.equal(publicProfileVerification({verification_status:'rejected'},true).state,'rejected');
});
test('activity defaults reflect type, preserve deliberate custom order and visible sections',()=>{
 assert.equal(profileActivityOrder({account_type:'merchant'})[0],'market');
 assert.equal(profileActivityOrder({account_type:'freelance'})[0],'services');
 assert.equal(profileActivityOrder({account_type:'standard'})[0],'questions');
 assert.equal(profileActivityOrder({account_type:'merchant'},['stats','identity','featured','bio','services','questions','products','requests','reviews','achievements'])[0],'market');
 assert.equal(profileActivityOrder({account_type:'merchant'},['stats','questions','services','products','reviews'])[0],'questions');
 assert.equal(profileStartingTab({account_type:'freelance'},{services:0,market:2},['services','questions','market']),'market');
 assert.equal(profileStartingTab({account_type:'merchant'},{market:5},['questions']),'questions');
});
