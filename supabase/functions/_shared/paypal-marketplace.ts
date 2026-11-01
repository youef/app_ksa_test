import {paypalConfiguration,paypalApi,verifyPayPalOrder,paypalApprovalUrl,type PayPalConfig} from './paypal.ts';

const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const check=(result:any)=>{if(result.error)throw new Error('paypal_database_error');return result.data;};
const publicQuote=(order:any,q:any)=>({order_id:order.id,quote:{id:q.id,currency:'USD',amount_minor:q.amount_minor,source_currency:'SAR',source_amount_minor:q.source_amount_minor,rate_micros:q.rate_micros,expires_at:new Date(q.expires_at).toISOString(),environment:q.environment}});

export async function settlePayPalOrder(admin:any,local:any,config:PayPalConfig,api:Awaited<ReturnType<typeof paypalApi>>,allowCapture:boolean) {
  let remote=await api('/v2/checkout/orders/'+encodeURIComponent(local.gateway_invoice_id));
  verifyPayPalOrder(remote,local,config);
  if(remote.status==='APPROVED'&&allowCapture){
    // Retry-safe at PayPal; always fetch the authoritative representation afterwards.
    try{await api('/v2/checkout/orders/'+remote.id+'/capture',{},'capture-'+local.id);}catch{/* A capture may have succeeded before its response was lost. */}
    remote=await api('/v2/checkout/orders/'+encodeURIComponent(local.gateway_invoice_id));
  }
  const capture=verifyPayPalOrder(remote,local,config,true);
  return check(await admin.rpc('hayna_confirm_paypal',{p_order:local.id,p_invoice:remote.id,p_capture:capture,p_usd_cents:local.paypal_quote.amount_minor,p_merchant:config.merchant,p_environment:config.environment}));
}

export async function handlePayPalCheckout(body:any,authClient:any,admin:any,userId:string,baseUrl:string,read:(name:string)=>string|undefined) {
  const config=paypalConfiguration(read);
  if(!config)return json(body.kind==='status'?{ready:false,gateway:'paypal',currency:'USD',reason:'paypal_setup_required'}:{error:'PayPal يحتاج حساب Business وإعدادات الخادم واختبار Sandbox أولًا.',code:'paypal_setup_required'},body.kind==='status'?200:503);
  const installed=await admin.rpc('hayna_paypal_ready');
  if(installed.error||installed.data!=='paypal_v1')return json(body.kind==='status'?{ready:false,gateway:'paypal',reason:'paypal_database_setup_required'}:{error:'ربط PayPal بقاعدة البيانات لم يعتمد بعد.'},body.kind==='status'?200:503);
  if(body.kind==='status')return json({ready:true,gateway:'paypal',currency:'USD',environment:config.environment});
  try{
    if(body.kind==='paypal_capture'||body.kind==='paypal_approve'){
      if(!uuid(body.order_id))return json({error:'مرجع الطلب غير صالح.'},400);
      const local=check(await admin.from('marketplace_orders').select('*').eq('id',body.order_id).eq('user_id',userId).eq('gateway','paypal').maybeSingle());
      if(!local)return json({error:'الطلب غير موجود.'},404);
      if(local.status==='paid')return json({status:'paid',order_id:local.id,reused:true});
      if(local.status!=='pending')return json({error:'انتهت هذه المحاولة. ابدأ طلبًا جديدًا.'},409);
      const q=local.paypal_quote;
      if(!q||q.merchant_id!==config.merchant||q.environment!==config.environment)throw new Error('paypal_quote_configuration_changed');
      if(body.kind==='paypal_capture'){
        if(!local.gateway_invoice_id)return json({error:'لم يُجهز رابط الدفع لهذا الطلب.'},409);
        const api=await paypalApi(config);
        const result=await settlePayPalOrder(admin,local,config,api,true);
        return json({status:'paid',order_id:local.id,duplicate:result?.duplicate===true});
      }
      if(body.quote_id!==q.id)return json({error:'راجع عرض التحويل الحالي أولًا.'},409);
      if(local.gateway_invoice_id&&local.checkout_url)return json({order_id:local.id,checkout_url:paypalApprovalUrl(local.checkout_url,config.environment,local.gateway_invoice_id)});
      if(new Date(q.expires_at).getTime()<=Date.now())return json({error:'انتهت صلاحية عرض التحويل. أعد فتح الصفحة لطلب عرض جديد.'},409);
      const api=await paypalApi(config);
      const app=new URL(baseUrl);if(app.protocol!=='https:'||app.username||app.password)throw new Error('paypal_return_url_invalid');
      const remote=await api('/v2/checkout/orders',{
        intent:'CAPTURE',purchase_units:[{reference_id:local.id,invoice_id:local.id,custom_id:q.id,description:'طلب سوق حيّنا',payee:{merchant_id:config.merchant},amount:{currency_code:'USD',value:(q.amount_minor/100).toFixed(2)}}],
        payment_source:{paypal:{experience_context:{brand_name:'حيّنا',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW',return_url:baseUrl+'/marketplace-dashboard?payment=paypal_approved&order_id='+local.id,cancel_url:baseUrl+'/marketplace-dashboard?payment=cancelled&order_id='+local.id}}},
      },'create-'+local.id);
      if(typeof remote.id!=='string'||! /^[A-Z0-9]{5,64}$/.test(remote.id))throw new Error('paypal_provider_order_invalid');
      verifyPayPalOrder(remote,{...local,gateway_invoice_id:remote.id},config);
      const link=remote.links?.find((item:any)=>item.rel==='payer-action'||item.rel==='approve');
      const checkoutUrl=paypalApprovalUrl(link?.href,config.environment,remote.id);
      check(await admin.rpc('hayna_bind_paypal',{p_order:local.id,p_quote:q.id,p_invoice:remote.id,p_url:checkoutUrl}));
      return json({order_id:local.id,checkout_url:checkoutUrl,status:'pending',gateway:'paypal'});
    }
    const prepared=check(await authClient.rpc('hayna_prepare_paypal_checkout',{p_request_id:typeof body.request_id==='string'?body.request_id.slice(0,100):'',p_kind:body.kind,p_reference:body.plan_slug||body.package_slug||'',p_service_id:body.service_id||null,p_title:body.title||'',p_description:body.description||'',p_note:body.note||''}));
    if(prepared.order.status==='paid')return json({status:'paid',order_id:prepared.order.id});
    const q=check(await admin.rpc('hayna_quote_paypal',{p_order:prepared.order.id,p_rate_micros:config.rateMicros,p_environment:config.environment,p_merchant:config.merchant}));
    return json(publicQuote(prepared.order,q));
  }catch{
    // Never return SDK objects, access tokens, credentials or provider customer payloads.
    return json({error:'تعذر تأكيد الطلب لدى PayPal. لن يُعتبر مدفوعًا دون تحقق الخادم. راجع الطلبات وأعد المحاولة.',code:'paypal_verification_failed'},502);
  }
}
