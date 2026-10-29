const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const file=require.resolve('../lib/servicePublishingRules.ts'),m=new Module(file);
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
test('service map links accept HTTPS map providers and reject executable, lookalike or credential URLs',()=>{
 for(const url of ['https://maps.app.goo.gl/example','https://www.google.com/maps?q=Riyadh','https://maps.apple.com/'])assert.equal(m.exports.safeServiceMapUrl(url),url);
 for(const url of ['javascript:alert(1)','http://maps.google.com/x','https://google.com.attacker.example/x','https://user:secret@maps.google.com/x','https://example.com',null])assert.equal(m.exports.safeServiceMapUrl(url),null);
});
