const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {productRequestTotal,sendProductRequest}=require('../lib/productRequest.ts');
const input={itemId:'20000000-0000-4000-8000-000000000001',requestId:'30000000-0000-4000-8000-000000000001',quantity:2,note:'اللون الأخضر',expectedPrice:'10.25',fulfillment:'استلام من الموقع'};
test('request totals retain unknown prices and calculate halalas without inflating quantities',()=>{
 assert.equal(productRequestTotal('10.25',2),2050);assert.equal(productRequestTotal(null,2),null);assert.equal(productRequestTotal(0,1),0);
 for(const quantity of [0,21,1.5])assert.throws(()=>productRequestTotal(10,quantity));
});
test('creation uses the atomic server RPC and keeps reference, terms and expected price',async()=>{
 let captured;const client={rpc:async(name,args)=>{captured={name,args};return {data:{conversationId:'chat',reused:false}};}};
 assert.equal((await sendProductRequest(client,input)).conversationId,'chat');assert.equal(captured.name,'hayna_create_product_request');assert.equal(captured.args.p_request,input.requestId);assert.equal(captured.args.p_expected_price,10.25);assert.equal(captured.args.p_fulfillment,'استلام من الموقع');
});
test('lost acknowledgement retries the same server reference and returns the saved request',async()=>{
 let reference,calls=0;const client={rpc:async(name,args)=>{assert.ok(!reference||reference===args.p_request);reference=args.p_request;if(++calls===1)return {error:{message:'network'}};return {data:{conversationId:'chat',reused:true}};}};
 await assert.rejects(sendProductRequest(client,input));assert.equal((await sendProductRequest(client,input)).reused,true);assert.equal(calls,2);
});
test('server rejections are Arabic and do not become a successful order',async()=>{
 for(const message of ['product_contact_restricted','product_price_changed','product_fulfillment_changed','product_unavailable','authentication_required'])await assert.rejects(sendProductRequest({rpc:async()=>({error:{message}})},input),error=>/[\u0600-\u06ff]/.test(error.message));
});
test('invalid reference or quantity is rejected without invoking a server action',async()=>{
 const client={rpc:()=>{throw new Error('must not execute');}};
 await assert.rejects(sendProductRequest(client,{...input,requestId:'invalid'}));await assert.rejects(sendProductRequest(client,{...input,quantity:99}));
});
