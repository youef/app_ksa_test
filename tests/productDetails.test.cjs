const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const file=require.resolve('../lib/productDetails.ts'),m=new Module(file);
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {parseProductDetails,productDisplayPrice,productFulfillmentOptions}=m.exports;

test('product detail suffix retains defects, warranty, invoice and delivery terms',()=>{
 const input='وصف المنتج\n\nتفاصيل المنتج\nالعيوب: خدش\nالملحقات: شاحن\nالضمان: بدون ضمان\nالفاتورة: متوفرة\nالاستلام: استلام أو توصيل\nتكلفة التوصيل: ٢٠ ر.س\nموعد التسليم: خلال يومين';
 const result=parseProductDetails(input);assert.equal(result.body,'وصف المنتج');assert.equal(result.specs.length,7);
 assert.deepEqual(productFulfillmentOptions(input),['استلام من الموقع','توصيل بالتنسيق']);
 assert.deepEqual(productFulfillmentOptions('وصف قديم'),['بالاتفاق مع البائع']);
 assert.deepEqual(productFulfillmentOptions('وصف\n\nتفاصيل المنتج\nالاستلام: استلام من الموقع'),['استلام من الموقع']);
});
test('legacy descriptions remain intact; only recognized detail suffixes become specs',()=>{
 assert.deepEqual(parseProductDetails('وصف الإعلان القديم'),{body:'وصف الإعلان القديم',specs:[]});
 assert.deepEqual(parseProductDetails('الوصف\n\nتفاصيل المنتج\nالحالة: جديد\nالمقاسات: ١٢٠ × ٦٠'),{body:'الوصف',specs:[{label:'الحالة',value:'جديد'},{label:'المقاسات',value:'١٢٠ × ٦٠'}]});
 const unknown='وصف\n\nتفاصيل المنتج\nنص آخر';assert.equal(parseProductDetails(unknown).body,unknown);
});
test('donations, unknown prices and fixed prices have truthful distinct labels',()=>{
 assert.equal(productDisplayPrice(null,'تبرع'),'مجاني');assert.equal(productDisplayPrice(null,'منتج تجاري'),'السعر بالتفاوض');
 assert.match(productDisplayPrice(-1,'بيع'),/تواصل/);assert.match(productDisplayPrice('150.5','بيع'),/١٥٠/);
});
