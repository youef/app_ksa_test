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
    const {data:result,error:confirmationError}=await admin.rpc('hayna_confirm_marketplace_payment',{
      p_order:order.id,p_gateway:'moyasar',p_invoice:invoiceId,p_amount:order.amount_halalas,p_currency:'SAR',p_payment:invoice?.payment?.id || null,
    });
    if(confirmationError)throw confirmationError;
    return json({received:true,processed:true,duplicate:result?.duplicate===true});

  } catch (error) {
    console.error('moyasar-marketplace-webhook failed', error);
    return json({ error: 'Webhook processing failed.' }, 500);
  }
});
