type ReadEnv = (name: string) => string | undefined;
export type PayPalConfig = { clientId: string; secret: string; webhookId: string; merchant: string; environment: 'sandbox' | 'live'; rateMicros: number; base: string };
export function paypalConfiguration(read: ReadEnv): PayPalConfig | null {
  const clientId=read('PAYPAL_CLIENT_ID'),secret=read('PAYPAL_CLIENT_SECRET'),webhookId=read('PAYPAL_WEBHOOK_ID'),merchant=read('PAYPAL_MERCHANT_ID');
  const environment=read('PAYPAL_ENVIRONMENT')||'sandbox',rate=read('PAYPAL_SAR_PER_USD')||'';
  if(!clientId||!secret||!webhookId||!merchant||! /^[A-Z0-9]{5,64}$/.test(merchant)||! /^(?:0|[1-9]\d{0,3})(?:\.\d{1,6})?$/.test(rate))return null;
  const rateMicros=Math.round(Number(rate)*1_000_000);
  if(!rateMicros||!['sandbox','live'].includes(environment)||environment==='live'&&read('PAYPAL_LIVE_ENABLED')!=='true')return null;
  return {clientId,secret,webhookId,merchant,environment:environment as 'sandbox'|'live',rateMicros,base:environment==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com'};
}
export function usdMinor(value: unknown): number {
  if(typeof value!=='string'||! /^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value))throw new Error('paypal_invalid_amount');
  const [whole,fraction='']=value.split('.');const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents<=0)throw new Error('paypal_invalid_amount');return cents;
}
export async function paypalApi(config: PayPalConfig) {
  const tokenResponse=await fetch(config.base+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+btoa(config.clientId+':'+config.secret),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
  const token=await tokenResponse.json();if(!tokenResponse.ok||typeof token.access_token!=='string')throw new Error('paypal_authentication_failed');
  return async(path: string,body?: unknown,requestId?: string)=>{
    const response=await fetch(config.base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',Prefer:'return=representation',...(requestId?{'PayPal-Request-Id':requestId}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error('paypal_provider_request_failed');return data;
  };
}
export function verifyPayPalOrder(order: any,local: any,config: PayPalConfig,completed=false) {
  const q=local.paypal_quote,units=order?.purchase_units;
  if(!q||q.environment!==config.environment||q.merchant_id!==config.merchant||order?.id!==local.gateway_invoice_id||order.intent!=='CAPTURE'||!Array.isArray(units)||units.length!==1)throw new Error('paypal_order_mismatch');
  const unit=units[0];
  if(unit.reference_id!==local.id||unit.custom_id!==q.id||unit.invoice_id!==local.id||unit.payee?.merchant_id!==config.merchant||unit.amount?.currency_code!=='USD'||usdMinor(unit.amount.value)!==q.amount_minor)throw new Error('paypal_order_mismatch');
  if(!completed)return null;
  const captures=unit.payments?.captures;
  if(order.status!=='COMPLETED'||!Array.isArray(captures)||captures.length!==1||captures[0].status!=='COMPLETED'||captures[0].amount?.currency_code!=='USD'||usdMinor(captures[0].amount.value)!==q.amount_minor||! /^[A-Z0-9]{5,64}$/.test(captures[0].id))throw new Error('paypal_capture_not_completed');
  return captures[0].id as string;
}
export function paypalApprovalUrl(value: unknown,environment: 'sandbox'|'live',id: string): string {
  const url=new URL(typeof value==='string'?value:'');const host=environment==='live'?'www.paypal.com':'www.sandbox.paypal.com';
  if(url.protocol!=='https:'||url.hostname!==host||url.port||url.username||url.password||url.pathname!=='/checkoutnow'||url.searchParams.get('token')!==id)throw new Error('paypal_checkout_url_invalid');
  return 'https://'+host+'/checkoutnow?token='+id;
}
export async function verifyPayPalWebhook(api: Awaited<ReturnType<typeof paypalApi>>,config: PayPalConfig,req: Request,event: unknown) {
  const names=['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'];
  if(names.some(name=>!req.headers.get(name)))throw new Error('paypal_signature_missing');
  const cert=new URL(req.headers.get('paypal-cert-url')!);
  const hosts=config.environment==='live'?['api.paypal.com','api-m.paypal.com']:['api.sandbox.paypal.com','api-m.sandbox.paypal.com'];
  if(cert.protocol!=='https:'||cert.username||cert.password||cert.port||!hosts.includes(cert.hostname)||!cert.pathname.startsWith('/v1/notifications/certs/'))throw new Error('paypal_certificate_invalid');
  const result=await api('/v1/notifications/verify-webhook-signature',{auth_algo:req.headers.get(names[0]),cert_url:cert.href,transmission_id:req.headers.get(names[2]),transmission_sig:req.headers.get(names[3]),transmission_time:req.headers.get(names[4]),webhook_id:config.webhookId,webhook_event:event});
  if(result.verification_status!=='SUCCESS')throw new Error('paypal_signature_invalid');
}
