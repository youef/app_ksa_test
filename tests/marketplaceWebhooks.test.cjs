const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual Edge handler, replacing only HTTP and database boundaries.
function handler(gateway, options = {}) {
  let run;
  const calls = [];
  const providerId = 'invoice-qa';
  const order = { id: 'order-qa', user_id: 'buyer-qa', amount_halalas: 4900, gateway_invoice_id: providerId };
  const payment = { id: providerId, status: gateway === 'tap' ? 'CAPTURED' : 'paid', amount: gateway === 'tap' ? 49 : 4900, currency: 'SAR', metadata: { marketplace_order_id: order.id, user_id: order.user_id }, ...options.payment };
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: order }; } };
  const source = fs.readFileSync(`supabase/functions/${gateway}-marketplace-webhook/index.ts`, 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, {
    serve: fn => { run = fn; }, Request, Response, btoa, console: { error() {} },
    Deno: { env: { get: name => options.missingSecret && name.endsWith('SECRET_KEY') ? undefined : 'test-only-placeholder' } },
    fetch: async () => { calls.push('verify'); if (options.networkError) throw new Error('offline'); return new Response(JSON.stringify(payment), { status: options.providerStatus || 200 }); },
    createClient: () => ({ from: () => query, rpc: async (name, args) => { calls.push({ name, args }); return options.rpcError ? { error: new Error('database unavailable') } : { data: { duplicate: !!options.duplicate } }; } }),
  });
  return { calls, invoke: body => run(new Request('https://test.invalid/callback', { method: 'POST', body: JSON.stringify(body || { id: providerId }) })) };
}

for (const gateway of ['moyasar', 'tap']) {
  test(`${gateway}: verified payment uses atomic RPC; duplicate delivery is acknowledged`, async () => {
    const h = handler(gateway, { duplicate: true }); const response = await h.invoke();
    assert.equal(response.status, 200); assert.equal((await response.json()).duplicate, true);
    assert.equal(h.calls[0], 'verify'); assert.equal(h.calls[1].name, 'hayna_confirm_marketplace_payment');
    assert.equal(h.calls[1].args.p_amount, 4900);
  });
  for (const [label, options, status] of [
    ['amount mismatch', { payment: { amount: 1 } }, 409],
    ['currency mismatch', { payment: { currency: 'USD' } }, 409],
    ['owner mismatch', { payment: { metadata: { marketplace_order_id: 'order-qa', user_id: 'outsider' } } }, 409],
    ['invoice mismatch', { payment: { id: 'different' } }, 400],
    ['cancelled payment', { payment: { status: 'CANCELLED' } }, 200],
    ['refunded payment cannot reactivate', { payment: { status: 'REFUNDED' } }, 200],
    ['gateway offline', { networkError: true }, 500],
    ['missing server key', { missingSecret: true }, 503],
  ]) test(`${gateway}: ${label}`, async () => {
    const h = handler(gateway, options); assert.equal((await h.invoke()).status, status);
    assert.equal(h.calls.filter(call => typeof call === 'object').length, 0);
  });
  test(`${gateway}: database failure returns retryable error`, async () => {
    const h = handler(gateway, { rpcError: true }); assert.equal((await h.invoke()).status, 500);
  });
}

function checkoutHandler({ missingKey = false, authenticated = true } = {}) {
  let run; let writes = 0;
  const source = fs.readFileSync('supabase/functions/create-marketplace-checkout/index.ts', 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, {
    serve: fn => { run = fn; }, Request, Response, btoa, console: { error() {} },
    Deno: { env: { get: name => name === 'PAYMENT_GATEWAY' ? 'moyasar' : missingKey && name === 'MOYASAR_SECRET_KEY' ? undefined : 'test-only-placeholder' } },
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'buyer-qa' } : null } }) }, rpc: () => { writes++; throw new Error('unexpected write'); } }),
    fetch: () => { throw new Error('unexpected provider request'); },
  });
  return { invoke: body => run(new Request('https://test.invalid/checkout', { method: 'POST', headers: { Authorization: 'Bearer test-only-placeholder' }, body: JSON.stringify(body) })), writes: () => writes };
}
test('unconfigured checkout returns 503 without creating orders or contacting provider', async () => {
  const h = checkoutHandler({ missingKey: true }); assert.equal((await h.invoke({ kind: 'subscription' })).status, 503); assert.equal(h.writes(), 0);
});
test('readiness returns a boolean without keys or financial writes', async () => {
  const h = checkoutHandler({ missingKey: true }); const response = await h.invoke({ kind: 'status' });
  assert.deepEqual(await response.json(), { ready: false, gateway: 'moyasar', reason: 'payment_configuration_missing' }); assert.equal(h.writes(), 0);
});
test('expired session cannot inspect readiness or create payment', async () => {
  const h = checkoutHandler({ authenticated: false }); assert.equal((await h.invoke({ kind: 'status' })).status, 401); assert.equal(h.writes(), 0);
});
