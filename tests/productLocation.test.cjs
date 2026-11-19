const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const file=require.resolve('../lib/productLocationRules.ts'),m=new Module(file);
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {productPositionError,confirmProductPosition,productPositionDistance,parseProductPrice,formatProductListingPrice}=m.exports;
const now=Date.now(),fix={latitude:24.7,longitude:46.7,accuracy:15,timestamp:now};
test('only fresh finite accurate device samples pass',()=>{
 assert.equal(productPositionError(fix,now),null);
 for(const override of [{latitude:NaN},{longitude:181},{accuracy:101},{accuracy:-1},{accuracy:Infinity},{timestamp:now-120001},{timestamp:now+6000},{mocked:true}])assert.ok(productPositionError({...fix,...override},now));
});
test('publication rechecks movement without disclosing coordinates in errors',()=>{
 assert.equal(productPositionDistance(fix,fix),0);
 assert.doesNotThrow(()=>confirmProductPosition(fix,{...fix,latitude:24.7001},now));
 assert.throws(()=>confirmProductPosition(fix,{...fix,latitude:24.71},now),/ابتعدت/);
 assert.throws(()=>confirmProductPosition(fix,{...fix,timestamp:now-120001},now),/قديمة/);
 assert.throws(()=>confirmProductPosition({...fix,latitude:NaN},fix,now),/صحيحة/);
});
test('Arabic prices retain two-decimal precision and reject missing, negative or malformed prices',()=>{
 assert.equal(parseProductPrice('١٬٢٥٠٫٥٠'),1250.5);assert.equal(parseProductPrice(''),null);
 for(const value of ['٠','-5','1e3','50.999','Infinity','10 ريال'])assert.ok(Number.isNaN(parseProductPrice(value)),value);
});

test('listing preview labels donation, loan and sale prices accurately',()=>{
 assert.equal(formatProductListingPrice('تبرع',false,''),'مجانًا · تبرع');
 assert.equal(formatProductListingPrice('إعارة',false,''),'إعارة · دون سعر');
 assert.equal(formatProductListingPrice('بيع',true,''),'السعر بالتفاوض');
 assert.match(formatProductListingPrice('بيع',false,'١٥٠'),/ر\.س$/);
 assert.equal(formatProductListingPrice('بيع',false,'10.999'),'لم يحدد السعر بعد');
 assert.match(formatProductListingPrice('بيع',false,'150',true),/ر\.س$/);
});
