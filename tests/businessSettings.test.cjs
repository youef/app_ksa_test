const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript'),path=require('node:path');
const cache={};function read(file){file=path.resolve(file);if(cache[file])return cache[file];const m=new Module(file);m.require=name=>name.startsWith('./')?read(path.resolve(path.dirname(file),name+'.ts')):require(name);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return cache[file]=m.exports;}
const {businessSettingsPayload}=read('./lib/businessSettings.ts');
test('business settings normalize public contacts and never accept ownership or verification fields',()=>{
 const draft={name:'متجر الحي',description:'نبذة',address:'شارع عام',phone:'0501234567',whatsapp:'',website:'example.com'};
 const result=businessSettingsPayload({...draft,owner_id:'other',is_verified:true});assert.equal(result.phone,'+966501234567');assert.equal(result.website,'https://example.com/');assert.equal('owner_id'in result,false);assert.equal('is_verified'in result,false);
 assert.throws(()=>businessSettingsPayload({...draft,name:'أ'}));assert.throws(()=>businessSettingsPayload({...draft,website:'javascript:alert(1)'}));assert.throws(()=>businessSettingsPayload({...draft,phone:'call-me'}));
});
