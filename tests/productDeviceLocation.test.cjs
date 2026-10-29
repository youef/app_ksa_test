const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),Module=require('node:module');
const rulesFile=require.resolve('../lib/productLocationRules.ts'),rules=new Module(rulesFile);
rules._compile(ts.transpileModule(fs.readFileSync(rulesFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,rulesFile);
function reader(platform,options={}){
 const calls=[],now=Date.now();const point={coords:{latitude:24.7,longitude:46.7,accuracy:15},timestamp:now};
 const output={};
 const source=ts.transpileModule(fs.readFileSync('lib/productDeviceLocation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports:output,require:name=>name==='react-native'?{Platform:{OS:platform}}:name==='expo-location'?{
  Accuracy:{High:4},requestForegroundPermissionsAsync:async()=>({granted:!options.denied}),hasServicesEnabledAsync:async()=>true,
  getCurrentPositionAsync:async settings=>{calls.push(settings);return {...point,mocked:options.mocked};},
 }:rules.exports,navigator:{geolocation:{getCurrentPosition:(success,failure,settings)=>{calls.push(settings);options.denied?failure({code:1}):success({...point,coords:{...point.coords,accuracy:options.accuracy??15}});}}},setTimeout,clearTimeout,Date,Number,Math,Error,Promise});
 return {read:output.readCurrentProductPosition,calls};
}
test('web explicitly requests a fresh high-accuracy sample without cached location fallback',async()=>{
 const h=reader('web');await h.read();assert.equal(h.calls[0].maximumAge,0);assert.equal(h.calls[0].enableHighAccuracy,true);assert.equal(h.calls[0].timeout,20000);
});
test('web permission denial and coarse IP location cannot become product location',async()=>{
 await assert.rejects(reader('web',{denied:true}).read(),/اسمح/);
 await assert.rejects(reader('web',{accuracy:5000}).read(),/لا تكفي/);
});
test('native requires foreground permission and rejects platform-reported mocked fixes',async()=>{
 const h=reader('android');await h.read();assert.equal(h.calls[0].accuracy,4);
 await assert.rejects(reader('ios',{denied:true}).read(),/اسمح/);
 await assert.rejects(reader('android',{mocked:true}).read(),/التجريبي/);
});
