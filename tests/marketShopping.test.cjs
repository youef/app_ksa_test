const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const file=require.resolve('../lib/marketShopping.ts'),m=new Module(file);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);
const {marketPrice,matchesMarketPrice,compareMarketPrices,marketGridLayout}=m.exports;
test('product columns fit fractional and rounded viewports without wrapping every card into one column',()=>{
 for(const width of [250,320,390,581.6,582,768,1024,1440]){
  const layout=marketGridLayout(width);assert.ok(layout.cardWidth*layout.columns+layout.gap*(layout.columns-1)<=Math.min(width,1100)-33);
 }
 assert.equal(marketGridLayout(390).columns,2);assert.equal(marketGridLayout(250).columns,1);assert.equal(marketGridLayout(1440).columns,4);
});
test('price bands have exclusive boundaries and never treat unknown or negotiated prices as free',()=>{
 assert.equal(marketPrice({price_from:0}),0);assert.equal(marketPrice({price_from:50,price_type:'negotiable'}),null);assert.equal(marketPrice({price_from:-1}),null);
 assert.equal(matchesMarketPrice({price_from:99},'under100'),true);assert.equal(matchesMarketPrice({price_from:100},'under100'),false);assert.equal(matchesMarketPrice({price_from:500},'100to500'),true);assert.equal(matchesMarketPrice({price_from:501},'over500'),true);assert.equal(matchesMarketPrice({price_from:null},'under100'),false);
});
test('unknown prices remain last in both ascending and descending sorting',()=>{
 const rows=[{price_from:null},{price_from:100},{price_from:0},{price_from:20}];
 assert.deepEqual([...rows].sort((a,b)=>compareMarketPrices(a,b)).map(x=>x.price_from),[0,20,100,null]);
 assert.deepEqual([...rows].sort((a,b)=>compareMarketPrices(a,b,true)).map(x=>x.price_from),[100,20,0,null]);
});
