const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const file=require.resolve('../lib/productContact.ts'),m=new Module(file);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);const state=m.exports.productContactState;
const base={signedIn:true,own:false,available:true,canView:false,canMessage:false,failed:false};
test('available product with restricted messaging is not labelled unavailable',()=>{const result=state(base);assert.equal(result.action,'restricted');assert.equal(result.label,'التواصل مقيّد');});
test('connection failure offers retry instead of pretending privacy denied',()=>assert.equal(state({...base,failed:true}).action,'retry'));
test('signed-out buyer can sign in while owners can manage their own ad',()=>{assert.equal(state({...base,signedIn:false}).action,'signin');assert.equal(state({...base,own:true}).action,'manage');});
test('sold products cannot be ordered even when messaging is allowed',()=>assert.equal(state({...base,available:false,canMessage:true}).action,'unavailable'));
test('allowed buyer receives request actions, independent of profile display',()=>assert.equal(state({...base,canMessage:true}).action,'request'));
