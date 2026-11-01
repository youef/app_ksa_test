import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { paypalConfiguration, paypalApi } from '../_shared/paypal.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'سجّل الدخول أولاً.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'إعدادات الخادم غير مكتملة.' }, 503);

  try {
    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: 'انتهت الجلسة.' }, 401);
    const { data: allowed } = await authClient.rpc('hayna_marketplace_can_review');
    if (allowed !== true) {
      return json({ error: 'هذه العملية مخصصة للإدارة.' }, 403);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    if(body?.action==='payment_status'||body?.action==='payment_test'){
      const config=paypalConfiguration(name=>Deno.env.get(name));
      const names=['PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MERCHANT_ID','PAYPAL_WEBHOOK_ID','PAYPAL_SAR_PER_USD'];
      const checks=names.map(name=>({name,configured:Boolean(Deno.env.get(name))}));
      let connected=false;
      if(body.action==='payment_test'&&config){try{await paypalApi(config);connected=true;}catch{return json({error:'تعذر التحقق من اتصال PayPal. راجع مفاتيح البيئة وحساب التاجر؛ لم تُنشأ دفعة.'},502);}}
      const schema=await admin.rpc('hayna_paypal_ready');
      const configuredGateway=(Deno.env.get('PAYMENT_GATEWAY')||'moyasar').toLowerCase();
      return json({gateway:['paypal','moyasar','tap'].includes(configuredGateway)?configuredGateway:'unconfigured',environment:config?.environment||'sandbox',configuration_complete:Boolean(config),database_ready:!schema.error&&schema.data==='paypal_v1',connected,checks,live_enabled:Deno.env.get('PAYPAL_LIVE_ENABLED')==='true'});
    }
    if (body?.action === 'list') {
      const { data, error } = await admin.from('marketplace_ad_campaigns')
        .select('id,title,description,status,created_at,owner_id,package_id')
        .eq('status', 'pending_review').order('created_at', { ascending: true }).limit(100);
      if (error) throw error;
      const rows = data || [];
      const ownerIds = [...new Set(rows.map((row: any) => row.owner_id).filter(Boolean))];
      const packageIds = [...new Set(rows.map((row: any) => row.package_id).filter(Boolean))];
      const [{ data: owners }, { data: packages }] = await Promise.all([
        ownerIds.length ? admin.from('profiles').select('id,display_name,username').in('id', ownerIds) : Promise.resolve({ data: [] }),
        packageIds.length ? admin.from('marketplace_ad_packages').select('id,name,duration_days,price_halalas').in('id', packageIds) : Promise.resolve({ data: [] }),
      ]);
      const ownerMap = new Map((owners || []).map((item: any) => [item.id, item]));
      const packageMap = new Map((packages || []).map((item: any) => [item.id, item]));
      return json({ campaigns: rows.map((row: any) => ({ ...row, owner: ownerMap.get(row.owner_id) || null, package: packageMap.get(row.package_id) || null })) });
    }

    if (body?.action === 'review') {
      const campaignId = typeof body.campaign_id === 'string' ? body.campaign_id : '';
      const decision = body.decision;
      if (!campaignId || !['approve', 'reject'].includes(decision)) return json({ error: 'طلب مراجعة غير صالح.' }, 400);
      const {error}=await authClient.rpc('hayna_review_marketplace_campaign',{p_campaign:campaignId,p_approve:decision==='approve'});
      if(error)throw error;
      return json({ success: true, decision });
    }
    return json({ error: 'الإجراء غير معروف.' }, 400);
  } catch (error) {
    console.error('marketplace-admin failed', error);
    return json({ error: 'تعذر إكمال عملية الإدارة.' }, 500);
  }
});
