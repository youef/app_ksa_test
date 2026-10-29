const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,globals={},cache=new Map()){
 file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,require:name=>load(path.resolve(path.dirname(file),name),globals,cache),URL,Request,Response,AbortSignal,btoa,console,...globals});return module.exports;
}
const env={PAYPAL_CLIENT_ID:'test-client',PAYPAL_CLIENT_SECRET:'test-secret',PAYPAL_WEBHOOK_ID:'test-webhook',PAYPAL_MERCHANT_ID:'MERCHANT123',PAYPAL_SAR_PER_USD:'3.75'};
const p=load('supabase/functions/_shared/paypal.ts'),config=p.paypalConfiguration(k=>env[k]);
const orderId='30000000-0000-4000-8000-000000000001',quoteId='30000000-0000-4000-8000-000000000002';
const local={id:orderId,gateway_invoice_id:'ORDER12345',paypal_quote:{id:quoteId,environment:'sandbox',merchant_id:'MERCHANT123',amount_minor:1307,source_amount_minor:4900,rate_micros:3750000,expires_at:'2099-01-01T00:00:00Z'}};
function remote(){return {id:'ORDER12345',intent:'CAPTURE',status:'COMPLETED',purchase_units:[{reference_id:orderId,invoice_id:orderId,custom_id:quoteId,payee:{merchant_id:'MERCHANT123'},amount:{currency_code:'USD',value:'13.07'},payments:{captures:[{id:'CAPTURE12345',status:'COMPLETED',amount:{currency_code:'USD',value:'13.07'}}]}}]};}
test('configuration defaults to sandbox and refuses live mode without explicit enablement',()=>{
 assert.equal(config.environment,'sandbox');assert.equal(config.rateMicros,3750000);
 for(const changed of [{PAYPAL_CLIENT_SECRET:''},{PAYPAL_SAR_PER_USD:''},{PAYPAL_SAR_PER_USD:'-1'},{PAYPAL_SAR_PER_USD:'3.7500001'},{PAYPAL_ENVIRONMENT:'live'},{PAYPAL_ENVIRONMENT:'attacker'}])assert.equal(p.paypalConfiguration(k=>({...env,...changed})[k]),null);
});
test('strict money parsing rejects exponent, negative, zero and sub-cent amounts',()=>{assert.equal(p.usdMinor('13.07'),1307);for(const x of ['1e3','13.071','-1','0.00',13.07,'NaN'])assert.throws(()=>p.usdMinor(x));});
test('only matching completed USD capture for the quoted merchant can settle',()=>{
 assert.equal(p.verifyPayPalOrder(remote(),local,config,true),'CAPTURE12345');
 for(const mutate of [x=>x.id='OTHER12345',x=>x.purchase_units[0].payee.merchant_id='OTHER12345',x=>x.purchase_units[0].custom_id='other',x=>x.purchase_units[0].amount.currency_code='SAR',x=>x.purchase_units[0].amount.value='13.08',x=>x.purchase_units[0].payments.captures[0].status='PENDING',x=>x.purchase_units[0].payments.captures[0].status='REFUNDED',x=>x.purchase_units.push(x.purchase_units[0])]){const r=remote();mutate(r);assert.throws(()=>p.verifyPayPalOrder(r,local,config,true));}
});
test('checkout URL validates environment, token and exact hostname',()=>{
 assert.equal(p.paypalApprovalUrl('https://www.sandbox.paypal.com/checkoutnow?token=ORDER12345','sandbox','ORDER12345'),'https://www.sandbox.paypal.com/checkoutnow?token=ORDER12345');
 for(const url of ['https://www.paypal.com/checkoutnow?token=ORDER12345','https://www.sandbox.paypal.com.attacker.example/checkoutnow?token=ORDER12345','https://user:pass@www.sandbox.paypal.com/checkoutnow?token=ORDER12345','https://www.sandbox.paypal.com/checkoutnow?token=OTHER12345'])assert.throws(()=>p.paypalApprovalUrl(url,'sandbox','ORDER12345'));
});
test('webhook validates all headers, certificate domain and PayPal verification result',async()=>{
 const headers={'paypal-auth-algo':'SHA256withRSA','paypal-cert-url':'https://api.sandbox.paypal.com/v1/notifications/certs/test','paypal-transmission-id':'transmission','paypal-transmission-sig':'signature','paypal-transmission-time':'2026-10-29T00:00:00Z'};let calls=0;
 const api=async(_,body)=>{calls++;assert.equal(body.webhook_id,'test-webhook');return{verification_status:'SUCCESS'};};
 await p.verifyPayPalWebhook(api,config,new Request('https://test.invalid',{headers}),{id:'event'});assert.equal(calls,1);
 await assert.rejects(p.verifyPayPalWebhook(api,config,new Request('https://test.invalid'),{}));
 await assert.rejects(p.verifyPayPalWebhook(api,config,new Request('https://test.invalid',{headers:{...headers,'paypal-cert-url':'https://attacker.example/cert'}}),{}));assert.equal(calls,1);
 await assert.rejects(p.verifyPayPalWebhook(async()=>({verification_status:'FAILURE'}),config,new Request('https://test.invalid',{headers}),{}));
});
test('lost capture acknowledgement is reconciled by GET and a stable request ID',async()=>{
 const h=load('supabase/functions/_shared/paypal-marketplace.ts');let reads=0,confirms=0;const calls=[];
 const api=async(url,body,id)=>{calls.push({url,id});if(body){assert.equal(id,'capture-'+orderId);throw new Error('lost ACK');}const r=remote();if(++reads===1)r.status='APPROVED';return r;};
 const db={rpc:async(name,args)=>{confirms++;assert.equal(name,'hayna_confirm_paypal');assert.equal(args.p_usd_cents,1307);return{data:{paid:true}};}};
 await h.settlePayPalOrder(db,local,config,api,true);assert.equal(reads,2);assert.equal(confirms,1);assert.equal(calls.length,3);
});
test('readiness does not expose secrets or create orders without setup or migration',async()=>{
 const h=load('supabase/functions/_shared/paypal-marketplace.ts');let calls=0;const db={rpc:async()=>{calls++;return{error:{message:'missing migration'}};}};
 const unconfigured=await h.handlePayPalCheckout({kind:'status'},null,db,'user','https://test.invalid',()=>undefined);assert.equal((await unconfigured.json()).ready,false);assert.equal(calls,0);
 const missing=await h.handlePayPalCheckout({kind:'status'},null,db,'user','https://test.invalid',k=>env[k]);const payload=await missing.json();assert.equal(payload.ready,false);assert.equal(JSON.stringify(payload).includes('test-secret'),false);assert.equal(calls,1);
});
test('client quote validator rejects tampered prices and states USD explicitly',()=>{
 const h=load('lib/paypalCheckout.ts'),value={order_id:orderId,quote:{...local.paypal_quote,currency:'USD',source_currency:'SAR'}};
 assert.ok(h.readPayPalQuote(value));assert.match(h.paypalQuoteDescription(value),/بالدولار/);assert.equal(h.readPayPalQuote({...value,quote:{...value.quote,amount_minor:4900}}),null);
});
test('quote creation ignores client amount/rate and uses authenticated server reservation',async()=>{
 const h=load('supabase/functions/_shared/paypal-marketplace.ts');let reserved=0;
 const auth={rpc:async(name,args)=>{reserved++;assert.equal(name,'hayna_prepare_paypal_checkout');assert.equal(args.p_kind,'subscription');assert.equal(Object.hasOwn(args,'amount'),false);return{data:{order:{id:orderId,status:'pending'}}};}};
 const db={rpc:async(name,args)=>{if(name==='hayna_paypal_ready')return{data:'paypal_v1'};assert.equal(name,'hayna_quote_paypal');assert.equal(args.p_rate_micros,3750000);return{data:local.paypal_quote};}};
 const response=await h.handlePayPalCheckout({kind:'subscription',plan_slug:'pro-monthly',request_id:'stable-quote-01',amount:1,rate_micros:1},auth,db,'buyer','https://test.invalid',k=>env[k]);
 const body=await response.json();assert.equal(response.status,200);assert.equal(reserved,1);assert.equal(body.quote.amount_minor,1307);assert.equal(body.quote.merchant_id,undefined);
});
test('another user cannot approve or capture a stored PayPal order',async()=>{
 let requests=0;const h=load('supabase/functions/_shared/paypal-marketplace.ts',{fetch:async()=>{requests++;throw new Error('unexpected');}});
 const query={select(){return this;},eq(field,value){if(field==='user_id')assert.equal(value,'outsider');return this;},async maybeSingle(){return{data:null};}};
 const db={rpc:async()=>({data:'paypal_v1'}),from:()=>query};
 for(const kind of ['paypal_approve','paypal_capture']){const response=await h.handlePayPalCheckout({kind,order_id:orderId,quote_id:quoteId},null,db,'outsider','https://test.invalid',k=>env[k]);assert.equal(response.status,404);}assert.equal(requests,0);
});
test('approval creates only a USD order and binds its checked link after explicit quote confirmation',async()=>{
 const requests=[];const h=load('supabase/functions/_shared/paypal-marketplace.ts',{fetch:async(url,init)=>{
  requests.push({url,init});if(url.endsWith('/token'))return new Response(JSON.stringify({access_token:'test-token'}));
  const body=JSON.parse(init.body);assert.equal(body.purchase_units[0].amount.currency_code,'USD');assert.equal(body.purchase_units[0].amount.value,'13.07');assert.equal(init.headers['PayPal-Request-Id'],'create-'+orderId);assert.equal(body.purchase_units[0].payee.merchant_id,'MERCHANT123');
  const r=remote();r.status='PAYER_ACTION_REQUIRED';delete r.purchase_units[0].payments;r.links=[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER12345'}];return new Response(JSON.stringify(r));
 }});
 const query={select(){return this;},eq(){return this;},async maybeSingle(){return{data:{...local,status:'pending',gateway_invoice_id:null}};}};let bound=0;
 const db={from:()=>query,rpc:async(name,args)=>{if(name==='hayna_paypal_ready')return{data:'paypal_v1'};assert.equal(name,'hayna_bind_paypal');bound++;assert.equal(args.p_quote,quoteId);return{data:null};}};
 const response=await h.handlePayPalCheckout({kind:'paypal_approve',order_id:orderId,quote_id:quoteId},null,db,'buyer','https://test.invalid',k=>env[k]);assert.equal(response.status,200);assert.equal(bound,1);assert.match((await response.json()).checkout_url,/sandbox\.paypal\.com/);assert.equal(requests.length,2);
});
test('missing or expired quote confirmation performs no external PayPal requests',async()=>{
 let requests=0;const h=load('supabase/functions/_shared/paypal-marketplace.ts',{fetch:async()=>{requests++;throw new Error('unexpected');}});let stale=false;
 const query={select(){return this;},eq(){return this;},async maybeSingle(){return{data:{...local,status:'pending',gateway_invoice_id:null,paypal_quote:{...local.paypal_quote,expires_at:stale?'2000-01-01T00:00:00Z':local.paypal_quote.expires_at}}};}};
 const db={from:()=>query,rpc:async()=>({data:'paypal_v1'})};
 assert.equal((await h.handlePayPalCheckout({kind:'paypal_approve',order_id:orderId},null,db,'buyer','https://test.invalid',k=>env[k])).status,409);stale=true;
 assert.equal((await h.handlePayPalCheckout({kind:'paypal_approve',order_id:orderId,quote_id:quoteId},null,db,'buyer','https://test.invalid',k=>env[k])).status,409);assert.equal(requests,0);
});
test('webhook rejects absent/invalid signatures and acknowledges only verified order settlement',async()=>{
 async function scenario(valid){let run,confirms=0,providerCalls=0;
  const db={from:()=>({select(){return this;},eq(){return this;},async maybeSingle(){return{data:local};}}),rpc:async(name)=>{assert.equal(name,'hayna_confirm_paypal');confirms++;return{data:{paid:true}};}};
  const globals={Deno:{env:{get:k=>({...env,SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-service'})[k]}},serve:fn=>{run=fn;},createClient:()=>db,fetch:async(url)=>{providerCalls++;if(url.endsWith('/token'))return new Response(JSON.stringify({access_token:'test-token'}));if(url.endsWith('verify-webhook-signature'))return new Response(JSON.stringify({verification_status:valid?'SUCCESS':'FAILURE'}));return new Response(JSON.stringify(remote()));}};
  const file='supabase/functions/paypal-marketplace-webhook/index.ts',source=fs.readFileSync(file,'utf8').replace(/^import \{serve\}.*\r?\n/m,'').replace(/^import \{createClient\}.*\r?\n/m,'');
  const module={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>load(path.resolve(path.dirname(file),name),globals),URL,Request,Response,AbortSignal,btoa,console,...globals});
  const event={event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{supplementary_data:{related_ids:{order_id:'ORDER12345'}}}};
  assert.equal((await run(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(event)}))).status,400);assert.equal(providerCalls,0);
  const headers={'paypal-auth-algo':'SHA256withRSA','paypal-cert-url':'https://api.sandbox.paypal.com/v1/notifications/certs/test','paypal-transmission-id':'transmission','paypal-transmission-sig':'sig','paypal-transmission-time':'2026-10-29T00:00:00Z'};
  const response=await run(new Request('https://test.invalid',{method:'POST',headers,body:JSON.stringify(event)}));assert.equal(response.status,valid?200:503);assert.ok(providerCalls>=2);assert.equal(confirms,valid?1:0);
 }
 await scenario(false);await scenario(true);
});
test('server sources typecheck against explicit Deno and transport declarations',()=>{
 const shim=path.resolve('artifacts/qa-runtime/paypal-types-virtual.d.ts');
 const declarations="declare const Deno:{env:{get(name:string):string|undefined}}; declare module 'https://deno.land/std@0.224.0/http/server.ts' { export function serve(handler:(req:Request)=>Response|Promise<Response>):void; } declare module 'https://esm.sh/@supabase/supabase-js@2' { export function createClient(...args:any[]):any; }";
 const options={strict:true,noEmit:true,skipLibCheck:true,allowImportingTsExtensions:true,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']};
 const host=ts.createCompilerHost(options),original=host.getSourceFile.bind(host);host.getSourceFile=(file,version,...rest)=>path.resolve(file)===shim?ts.createSourceFile(shim,declarations,version):original(file,version,...rest);
 const program=ts.createProgram(['supabase/functions/create-marketplace-checkout/index.ts','supabase/functions/_shared/paypal.ts','supabase/functions/_shared/paypal-marketplace.ts','supabase/functions/paypal-marketplace-webhook/index.ts',shim],options,host);
 const diagnostics=ts.getPreEmitDiagnostics(program);assert.equal(diagnostics.length,0,diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
});
