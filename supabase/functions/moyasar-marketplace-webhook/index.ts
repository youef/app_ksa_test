import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const moyasarSecret = Deno.env.get('MOYASAR_SECRET_KEY');
  if (!supabaseUrl || !serviceRoleKey || !moyasarSecret) {
    console.error('Marketplace webhook secrets are not configured.');
    return json({ error: 'Webhook is not configured.' }, 503);
  }

  try {
    const payload = await req.json();
    const invoiceId = typeof payload?.id === 'string' ? payload.id : '';
    if (!invoiceId) return json({ error: 'Missing invoice id.' }, 400);

    // Treat callbacks as hints only. Fetch the invoice from Moyasar using the
    // server-side secret before trusting status, amount, currency, or metadata.
    const verifyResponse = await fetch(`https://api.moyasar.com/v1/invoices/${encodeURIComponent(invoiceId)}`, {
      headers: { Authorization: `Basic ${btoa(`${moyasarSecret}:`)}` },
    });
    const invoice = await verifyResponse.json().catch(() => ({}));
    if (!verifyResponse.ok || invoice?.id !== invoiceId) return json({ error: 'Unable to verify invoice with gateway.' }, 400);
    if (invoice.status !== 'paid') return json({ received: true, processed: false, status: invoice.status || 'unknown' });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const orderId = invoice?.metadata?.marketplace_order_id;
    if (typeof orderId !== 'string') return json({ error: 'Invoice metadata is missing order reference.' }, 400);

    const { data: order, error: orderError } = await admin.from('marketplace_orders')
      .select('*').eq('id', orderId).eq('gateway', 'moyasar').maybeSingle();
    if (orderError || !order) return json({ error: 'Marketplace order not found.' }, 404);
    if (order.gateway_invoice_id && order.gateway_invoice_id !== invoiceId) return json({ error: 'Invoice does not match order.' }, 409);
    if (Number(invoice.amount) !== Number(order.amount_halalas) || String(invoice.currency || '').toUpperCase() !== 'SAR') {
      console.error('Marketplace invoice amount/currency mismatch', { orderId, invoiceId });
      return json({ error: 'Invoice amount or currency mismatch.' }, 409);
    }
    if (invoice?.metadata?.user_id !== order.user_id) return json({ error: 'Invoice owner mismatch.' }, 409);
    if (order.status === 'paid') return json({ received: true, processed: true, duplicate: true });

    const now = new Date();
    const { error: orderUpdateError } = await admin.from('marketplace_orders').update({
      status: 'paid', gateway_invoice_id: invoiceId, paid_at: now.toISOString(),
      metadata: { ...(order.metadata || {}), verified_gateway_status: 'paid', gateway_payment_id: invoice?.payment?.id || null },
      updated_at: now.toISOString(),
    }).eq('id', order.id).neq('status', 'paid');
    if (orderUpdateError) throw orderUpdateError;

    await admin.from('marketplace_payment_transactions').update({
      status: 'paid', paid_at: now.toISOString(),
      gateway_payload: { invoice_id: invoiceId, invoice_status: 'paid', payment_id: invoice?.payment?.id || null },
      updated_at: now.toISOString(),
    }).eq('order_id', order.id);

    if (order.order_type === 'service_order' && order.service_order_id) {
      const { error } = await admin.from('marketplace_service_orders').update({ status: 'paid', updated_at: now.toISOString() })
        .eq('id', order.service_order_id);
      if (error) throw error;
    } else if (order.order_type === 'subscription' && order.subscription_id) {
      const periodDays = Math.max(1, Number(order.period_days) || 30);
      const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
      const { error } = await admin.from('marketplace_subscriptions').update({
        status: 'active', current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(),
        auto_renew: false, cancel_at_period_end: false, last_payment_order_id: order.id, updated_at: now.toISOString(),
      }).eq('id', order.subscription_id);
      if (error) throw error;
    } else if (order.order_type === 'ad_campaign' && order.ad_campaign_id) {
      // Paid campaigns remain pending review. Payment does not bypass content moderation.
      const { error } = await admin.from('marketplace_ad_campaigns').update({ status: 'pending_review', updated_at: now.toISOString() })
        .eq('id', order.ad_campaign_id);
      if (error) throw error;
    }

    return json({ received: true, processed: true });
  } catch (error) {
    console.error('moyasar-marketplace-webhook failed', error);
    return json({ error: 'Webhook processing failed.' }, 500);
  }
});
