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
  const baseUrl = (Deno.env.get('APP_BASE_URL') || 'https://appksatest-yousef8-15e4.vercel.app').replace(/\/$/, '');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'إعدادات الخادم غير مكتملة.' }, 503);
  if (!['moyasar', 'tap'].includes(gateway)) return json({ error: 'اختر PAYMENT_GATEWAY=moyasar أو tap.' }, 503);
  if (gateway === 'moyasar' && !moyasarSecret) return json({ error: 'أضف MOYASAR_SECRET_KEY إلى أسرار Supabase لتفعيل الدفع.' }, 503);
  if (gateway === 'tap' && !tapSecret) return json({ error: 'أضف TAP_SECRET_KEY إلى أسرار Supabase لتفعيل الدفع.' }, 503);

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'انتهت الجلسة. سجّل الدخول مجددًا.' }, 401);
    const user = authData.user;
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    const kind = body?.kind;
    if (!['service_order', 'subscription', 'ad_campaign'].includes(kind)) return json({ error: 'نوع الدفع غير صالح.' }, 400);

    const rawRequestId = typeof body.request_id === 'string' ? body.request_id.slice(0, 100) : crypto.randomUUID();
    const idempotencyKey = `${user.id}:${rawRequestId}`;

    const { data: prior } = await admin.from('marketplace_orders').select('id,status,checkout_url,amount_halalas')
      .eq('idempotency_key', idempotencyKey).maybeSingle();
    if (prior) {
      if (prior.checkout_url && prior.status === 'pending') return json({ order_id: prior.id, checkout_url: prior.checkout_url, reused: true });
      if (prior.status === 'paid') return json({ order_id: prior.id, status: 'paid', reused: true });
      return json({ error: 'يوجد طلب سابق بهذه المحاولة. أنشئ محاولة جديدة إذا لم يكتمل الدفع.' }, 409);
    }

    let amountHalalas = 0;
    let periodDays: number | null = null;
    let planId: string | null = null;
    let packageId: string | null = null;
    let serviceOrderId: string | null = null;
    let subscriptionId: string | null = null;
    let adCampaignId: string | null = null;
    let description = 'طلب من سوق حيّنا';
    let metadata: Record<string, string> = { order_type: kind, user_id: user.id };

    if (kind === 'service_order') {
      const serviceId = typeof body.service_id === 'string' ? body.service_id : '';
      if (!serviceId) return json({ error: 'حدد الخدمة المطلوبة.' }, 400);
      const { data: service, error } = await admin.from('services')
        .select('id,provider_id,name,price_from,price_type,moderation_status,available_now')
        .eq('id', serviceId).maybeSingle();
      if (error || !service || service.moderation_status !== 'approved' || service.available_now === false) {
        return json({ error: 'الخدمة غير متاحة للطلب حالياً.' }, 404);
      }
      if (service.provider_id === user.id) return json({ error: 'لا يمكنك شراء خدمتك الخاصة.' }, 400);
      if (service.price_type && service.price_type !== 'fixed') return json({ error: 'هذه الخدمة تتطلب الاتفاق على السعر مع مقدمها قبل الدفع.' }, 400);
      amountHalalas = amountFromSar(service.price_from);
      if (!amountHalalas) return json({ error: 'لا يمكن الدفع إلكترونياً لهذه الخدمة قبل تحديد سعر ثابت.' }, 400);
      description = `طلب خدمة: ${String(service.name).slice(0, 100)}`;
      const { data: serviceOrder, error: serviceOrderError } = await admin.from('marketplace_service_orders').insert({
        buyer_id: user.id, provider_id: service.provider_id, service_id: service.id,
        service_name: service.name, amount_halalas: amountHalalas,
        buyer_note: typeof body.note === 'string' ? body.note.slice(0, 1000) : null,
      }).select('id').single();
      if (serviceOrderError || !serviceOrder) throw serviceOrderError || new Error('تعذر إنشاء طلب الخدمة.');
      serviceOrderId = serviceOrder.id;
      metadata.service_id = service.id;
    } else if (kind === 'subscription') {
      const slug = typeof body.plan_slug === 'string' ? body.plan_slug : '';
      const { data: plan } = await admin.from('marketplace_plans').select('id,slug,name,price_halalas,period_days,active')
        .eq('slug', slug).eq('active', true).maybeSingle();
      if (!plan || plan.price_halalas <= 0) return json({ error: 'الباقة غير متاحة للدفع أو مجانية.' }, 404);
      amountHalalas = plan.price_halalas;
      periodDays = plan.period_days;
      planId = plan.id;
      description = `اشتراك سوق حيّنا: ${plan.name}`;
      const { data: subscription, error } = await admin.from('marketplace_subscriptions').insert({
        user_id: user.id, plan_id: plan.id, status: 'pending',
      }).select('id').single();
      if (error || !subscription) throw error || new Error('تعذر إنشاء الاشتراك.');
      subscriptionId = subscription.id;
      metadata.plan_slug = plan.slug;
    } else {
      const packageSlug = typeof body.package_slug === 'string' ? body.package_slug : '';
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
      const serviceId = typeof body.service_id === 'string' ? body.service_id : null;
      if (!title) return json({ error: 'أدخل عنوان الإعلان.' }, 400);
      const { data: adPackage } = await admin.from('marketplace_ad_packages')
        .select('id,slug,name,price_halalas,duration_days,active').eq('slug', packageSlug).eq('active', true).maybeSingle();
      if (!adPackage) return json({ error: 'باقة الترويج غير متاحة.' }, 404);
      if (serviceId) {
        const { data: service } = await admin.from('services').select('id,provider_id').eq('id', serviceId).maybeSingle();
        if (!service || service.provider_id !== user.id) return json({ error: 'يمكنك ترويج عروضك أنت فقط.' }, 403);
      }
      amountHalalas = adPackage.price_halalas;
      packageId = adPackage.id;
      periodDays = adPackage.duration_days;
      description = `ترويج في سوق حيّنا: ${title}`;
      const { data: campaign, error } = await admin.from('marketplace_ad_campaigns').insert({
        owner_id: user.id, service_id: serviceId, package_id: adPackage.id,
        title, description: typeof body.description === 'string' ? body.description.slice(0, 1000) : '',
        status: 'pending_payment',
      }).select('id').single();
      if (error || !campaign) throw error || new Error('تعذر إنشاء حملة الإعلان.');
      adCampaignId = campaign.id;
      metadata.ad_package = adPackage.slug;
    }

    const { data: order, error: orderError } = await admin.from('marketplace_orders').insert({
      user_id: user.id, order_type: kind, amount_halalas: amountHalalas, currency: 'SAR',
      gateway, idempotency_key: idempotencyKey, service_order_id: serviceOrderId,
      subscription_id: subscriptionId, ad_campaign_id: adCampaignId, plan_id: planId,
      package_id: packageId, period_days: periodDays, metadata,
    }).select('id').single();
    if (orderError || !order) throw orderError || new Error('تعذر إنشاء طلب الدفع.');

    if (serviceOrderId) await admin.from('marketplace_service_orders').update({ payment_order_id: order.id }).eq('id', serviceOrderId);
    if (subscriptionId) await admin.from('marketplace_subscriptions').update({ last_payment_order_id: order.id }).eq('id', subscriptionId);
    if (adCampaignId) await admin.from('marketplace_ad_campaigns').update({ payment_order_id: order.id }).eq('id', adCampaignId);

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
