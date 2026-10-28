import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function amountFromSar(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'سجّل الدخول أولاً.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const gateway = (Deno.env.get('PAYMENT_GATEWAY') || 'moyasar').toLowerCase();
  const moyasarSecret = Deno.env.get('MOYASAR_SECRET_KEY');
  const tapSecret = Deno.env.get('TAP_SECRET_KEY');
  const baseUrl = (Deno.env.get('APP_BASE_URL') || 'https://appksatest.vercel.app').replace(/\/$/, '');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'إعدادات الخادم غير مكتملة.' }, 503);




  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'انتهت الجلسة. سجّل الدخول مجددًا.' }, 401);
    const user = authData.user;
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const ready = ['moyasar','tap'].includes(gateway) && Boolean(gateway==='moyasar'?moyasarSecret:tapSecret);
    if(body.kind==='status')return json({ready,gateway,reason:ready?null:'payment_configuration_missing'});
    if(!ready)return json({error:'الدفع الإلكتروني غير متاح حاليًا. يمكنك إدارة عروضك وتفعيل الباقة المجانية.',code:'payment_configuration_missing'},503);
    const rawRequestId=typeof body.request_id==='string'?body.request_id.slice(0,100):'';
    const {data:prepared,error:prepareError}=await authClient.rpc('hayna_prepare_marketplace_checkout',{
      p_request_id:rawRequestId,p_kind:body.kind,p_reference:body.plan_slug||body.package_slug||'',p_service_id:body.service_id||null,
      p_title:body.title||'',p_description:body.description||'',p_note:body.note||'',p_gateway:gateway,
    });
    if(prepareError)return json({error:'تعذر تجهيز الطلب. تحقق من صلاحية الحساب وحالة العرض أو الاشتراك.',code:prepareError.message},400);
    const order=prepared.order;
    if(!prepared.created){
      if(order.status==='paid')return json({order_id:order.id,status:'paid',reused:true});
      if(order.status==='pending'&&order.checkout_url)return json({order_id:order.id,checkout_url:order.checkout_url,reused:true});
      return json({error:'هذه المحاولة قيد المعالجة أو انتهت. حدّث الطلبات قبل بدء محاولة جديدة.',code:'checkout_attempt_exists'},409);
    }
    const amountHalalas=Number(order.amount_halalas),serviceOrderId=order.service_order_id,subscriptionId=order.subscription_id,adCampaignId=order.ad_campaign_id,kind=order.order_type;
    const description='طلب سوق حيّنا · '+order.id;
    const metadata={order_type:kind,user_id:user.id};
    const successUrl = `${baseUrl}/marketplace-dashboard?payment=success&order_id=${order.id}`;
    const backUrl = `${baseUrl}/marketplace-dashboard?payment=cancelled&order_id=${order.id}`;
    const callbackUrl = `${supabaseUrl}/functions/v1/${gateway === 'moyasar' ? 'moyasar-marketplace-webhook' : 'tap-marketplace-webhook'}`;
    let providerResponse: Response;
    if (gateway === 'moyasar') {
      providerResponse = await fetch('https://api.moyasar.com/v1/invoices', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${moyasarSecret}:`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountHalalas, currency: 'SAR', description, callback_url: callbackUrl,
          success_url: successUrl, back_url: backUrl,
          metadata: { marketplace_order_id: order.id, user_id: user.id, order_type: kind },
        }),
      });
    } else {
      providerResponse = await fetch('https://api.tap.company/v2/charges', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tapSecret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number((amountHalalas / 100).toFixed(2)), currency: 'SAR', description,
          source: { id: 'src_all' },
          customer: { first_name: String(user.user_metadata?.full_name || user.user_metadata?.name || 'Hayna customer').slice(0, 80), ...(user.email ? { email: user.email } : {}) },
          redirect: { url: successUrl },
          post: { url: callbackUrl },
          metadata: { marketplace_order_id: order.id, user_id: user.id, order_type: kind },
        }),
      });
    }
    const payment = await providerResponse.json().catch(() => ({}));
    const checkoutUrl = gateway === 'moyasar' ? payment?.url : (payment?.transaction?.url || payment?.redirect?.url);
    if (!providerResponse.ok || !payment?.id || !checkoutUrl) {
      await admin.from('marketplace_orders').update({ status: 'failed', metadata: { ...metadata, gateway_error: payment?.message || payment?.errors || 'checkout_creation_failed' } }).eq('id', order.id);
      if (serviceOrderId) await admin.from('marketplace_service_orders').update({ status: 'payment_failed' }).eq('id', serviceOrderId);
      return json({ error: `تعذر إنشاء صفحة الدفع لدى ${gateway === 'moyasar' ? 'Moyasar' : 'Tap'}؛ تحقق من مفاتيح API وتفعيل حساب التاجر.` }, 502);
    }

    const providerStatus = gateway === 'moyasar' ? (payment.status || 'initiated') : (payment.status || 'INITIATED');
    const { error: updateError } = await admin.from('marketplace_orders').update({
      gateway_invoice_id: payment.id, checkout_url: checkoutUrl,
      metadata: { ...metadata, gateway_status: providerStatus },
    }).eq('id', order.id);
    if (updateError) throw updateError;

    const { error: transactionError } = await admin.from('marketplace_payment_transactions').insert({
      order_id: order.id, user_id: user.id, gateway, gateway_invoice_id: payment.id,
      amount_halalas: amountHalalas, currency: 'SAR', status: 'pending',
      gateway_payload: { provider_id: payment.id, provider_status: providerStatus },
    });
    if (transactionError) throw transactionError;
    return json({ order_id: order.id, checkout_url: checkoutUrl, status: 'pending', gateway });
  } catch (error) {
    console.error('create-marketplace-checkout failed', error);
    return json({ error: 'تعذر تجهيز عملية الدفع. حاول مرة أخرى.' }, 500);
  }
});
