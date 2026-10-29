import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {paypalConfiguration,paypalApi,verifyPayPalWebhook,usdMinor} from '../_shared/paypal.ts';
import {settlePayPalOrder} from '../_shared/paypal-marketplace.ts';
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
serve(async req=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'].some(name=>!req.headers.get(name)))return json({error:'Missing PayPal signature'},400);
  const config=paypalConfiguration(name=>Deno.env.get(name)),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!config||!url||!key)return json({error:'PayPal is not configured.'},503);
  try{
    const raw=await req.text();if(raw.length>262144)return json({error:'Payload too large'},413);
    const event=JSON.parse(raw),api=await paypalApi(config);
    await verifyPayPalWebhook(api,config,req,event);
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    if(event.event_type==='PAYMENT.CAPTURE.REFUNDED'){
      const up=event.resource?.links?.find((link:any)=>link.rel==='up')?.href;
      const captureId=typeof up==='string'?new URL(up).pathname.match(/^\/v2\/payments\/captures\/([A-Z0-9]{5,64})$/)?.[1]:null;
      if(!captureId)return json({error:'Missing capture reference'},400);
      const capture=await api('/v2/payments/captures/'+captureId);
      const result=await admin.from('marketplace_orders').select('*').eq('gateway','paypal').eq('paypal_capture_id',captureId).maybeSingle();
      if(result.error||!result.data)return json({error:'Payment reconciliation pending'},503);
      const local=result.data,q=local.paypal_quote;
      if(q?.environment!==config.environment||q?.merchant_id!==config.merchant||capture.id!==captureId||capture.amount?.currency_code!=='USD'||usdMinor(capture.amount.value)!==q.amount_minor)return json({error:'Refund verification mismatch'},409);
      if(capture.status!=='REFUNDED')return json({error:'Partial or pending refunds require reconciliation',code:'paypal_partial_refund_review_required'},503);
      const commit=await admin.rpc('hayna_refund_paypal',{p_order:local.id,p_capture:captureId});if(commit.error)throw commit.error;
      return json({received:true,refunded:true});
    }
    if(!['CHECKOUT.ORDER.APPROVED','PAYMENT.CAPTURE.COMPLETED'].includes(event.event_type))return json({received:true,processed:false});
    const id=event.event_type==='CHECKOUT.ORDER.APPROVED'?event.resource?.id:event.resource?.supplementary_data?.related_ids?.order_id;
    if(typeof id!=='string'||! /^[A-Z0-9]{5,64}$/.test(id))return json({error:'Missing order reference'},400);
    const result=await admin.from('marketplace_orders').select('*').eq('gateway','paypal').eq('gateway_invoice_id',id).maybeSingle();
    if(result.error||!result.data)return json({error:'Order binding pending'},503);
    await settlePayPalOrder(admin,result.data,config,api,event.event_type==='CHECKOUT.ORDER.APPROVED');
    return json({received:true,processed:true});
  }catch{return json({error:'PayPal webhook verification or reconciliation failed.'},503);}
});
