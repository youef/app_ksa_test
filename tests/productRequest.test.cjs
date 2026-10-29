const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), ts = require('typescript');
const file = require.resolve('../lib/productRequest.ts'), compiled = new Module(file);
compiled._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { productRequestTotal, sendProductRequest } = compiled.exports;
const input = { itemId: '20000000-0000-4000-8000-000000000001', requestId: '30000000-0000-4000-8000-000000000001', quantity: 2, note: 'اللون الأخضر', expectedPrice: '10.25' };
function client(options = {}) {
  const state = { writes: 0, message: null, calls: [] };
  const api = {
    auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: 'buyer' } } }) },
    rpc: async (name) => { state.calls.push(name); return name === 'hayna_neighbor_access' ? { data: { can_message: !options.closed } } : { data: '40000000-0000-4000-8000-000000000001' }; },
    from(table) {
      let payload;
      const query = { select() { return query; }, eq() { return query; }, insert(value) { payload = value; return query; },
        async maybeSingle() { return { data: table === 'messages' ? state.message : { id: input.itemId, seller_id: options.self ? 'buyer' : 'seller', title: 'منتج', price: options.changed ? 11 : 10.25, status: options.sold ? 'sold' : 'available' } }; },
        async single() { state.writes++; state.message = payload; if (options.lostAck && state.writes === 1) return { error: { code: 'network' } }; return { data: { id: payload.id } }; }
      }; return query;
    }
  }; return { api, state };
}
test('product request totals use halalas, retain unknown prices and reject unsupported quantities', () => {
  assert.equal(productRequestTotal('10.25', 2), 2050); assert.equal(productRequestTotal(null, 2), null); assert.equal(productRequestTotal(0, 1), 0);
  for (const quantity of [0, 21, 1.5]) assert.throws(() => productRequestTotal(10, quantity));
});
test('explicit purchase enquiry writes one message and never creates a paid checkout', async () => {
  const { api, state } = client(); const result = await sendProductRequest(api, input);
  assert.equal(state.writes, 1); assert.equal(result.reused, false); assert.equal(state.message.id, input.requestId);
  assert.match(state.message.body, /الكمية المطلوبة/); assert.match(state.message.body, /اللون الأخضر/);
  assert.ok(state.calls.includes('hayna_neighbor_access')); assert.ok(state.calls.every(name => !/payment|checkout/.test(name)));
});
test('retry after a lost acknowledgement reuses the same saved request without sending again', async () => {
  const { api, state } = client({ lostAck: true }); await assert.rejects(sendProductRequest(api, input));
  const retried = await sendProductRequest(api, input); assert.equal(retried.reused, true); assert.equal(state.writes, 1);
});
test('closed DMs, self-purchases, sold items and changed prices never send a request', async () => {
  for (const options of [{ closed: true }, { self: true }, { sold: true }, { changed: true }, { anonymous: true }]) {
    const { api, state } = client(options); await assert.rejects(sendProductRequest(api, input)); assert.equal(state.writes, 0);
  }
});
