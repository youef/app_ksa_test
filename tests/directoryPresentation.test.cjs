const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const file = require.resolve('../lib/directoryPresentation.ts');
const compiled = new Module(file);
compiled._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { businessOpening, businessPhone, businessWebsite, directorySearch, fetchDirectoryPage } = compiled.exports;

test('Saudi opening status respects overnight boundaries and the Saturday/Sunday week rollover', () => {
  const periods = [{ day_of_week: 6, opens_at: '22:00:00', closes_at: '02:00:00', is_closed: false }];
  assert.equal(businessOpening(periods, new Date('2026-11-01T00:30:00+03:00')).open, true);
  assert.equal(businessOpening(periods, new Date('2026-11-01T02:00:00+03:00')).open, false);
  assert.equal(businessOpening(periods, new Date('2026-10-31T21:00:00+03:00')).nextOpening, '2026-10-31T19:00:00.000Z');
  assert.equal(businessOpening(periods, new Date('2026-10-31T22:00:00+03:00')).nextOpening, null);
});
test('missing hours stay unknown, closed days and multiple periods produce truthful status', () => {
  const now = new Date('2026-11-01T12:00:00+03:00');
  assert.deepEqual(businessOpening([], now), { hasSchedule: false, open: false, nextOpening: null });
  const periods = [{ day_of_week: 0, opens_at: '09:00', closes_at: '11:00', is_closed: false }, { day_of_week: 0, opens_at: '16:00', closes_at: '20:00', is_closed: false }];
  assert.equal(businessOpening(periods, now).open, false);
  assert.equal(businessOpening(periods, now).nextOpening, '2026-11-01T13:00:00.000Z');
  assert.equal(businessOpening([{ ...periods[0], is_closed: true }], now).open, false);
  assert.equal(businessOpening([{ ...periods[0], opens_at: '99:90' }], now).open, false);
});
test('commercial links reject executable protocols and credentials; phone links contain digits only', () => {
  assert.equal(businessWebsite('example.com/shop'), 'https://example.com/shop');
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:password@example.com', 'data:text/html,test']) assert.equal(businessWebsite(url), null);
  assert.equal(businessPhone('٠٥٠ ١٢٣ ٤٥٦٧'), '966501234567');
  assert.equal(businessPhone('00966 11 234 5678'), '966112345678');
  for (const value of ['123', '0501234567;extension=5', 'javascript:alert(1)']) assert.equal(businessPhone(value), null);
  assert.equal(directorySearch('كهرباء),is_verified.eq.false%'), 'كهرباء is verified eq false');
});

function clientFor(data, failure = null) {
  const calls = [];
  return { calls, from(table) {
    const events = []; calls.push({ table, events });
    const builder = { then(resolve, reject) { return Promise.resolve({ data: data[table] || [], error: failure }).then(resolve, reject); } };
    for (const method of ['select', 'eq', 'or', 'order', 'range']) builder[method] = (...args) => { events.push([method, ...args]); return builder; };
    return builder;
  } };
}
const options = { location: { city: 'عرعر', district: 'النخيل' }, kind: 'all', search: 'صيانة', verified: true, sort: 'recent', page: 1 };
test('city, district, approval and verification are applied before pagination for both directory sources', async () => {
  const client = clientFor({}); await fetchDirectoryPage(client, options);
  assert.equal(client.calls.length, 2);
  for (const { events } of client.calls) {
    for (const constraint of [['eq', 'moderation_status', 'approved'], ['eq', 'city', 'عرعر'], ['eq', 'district', 'النخيل'], ['eq', 'is_verified', true]]) assert.ok(events.some(event => JSON.stringify(event) === JSON.stringify(constraint)));
    assert.deepEqual(events.at(-1), ['range', 12, 24]);
    assert.ok(events.findIndex(event => event[0] === 'eq' && event[1] === 'city') < events.findIndex(event => event[0] === 'range'));
    assert.ok(!events[0][1].includes('owner:') && !events[0][1].includes('phone'));
  }
});
test('type selection avoids unnecessary reads; city scope does not apply a district filter', async () => {
  const client = clientFor({}); await fetchDirectoryPage(client, { ...options, kind: 'service', verified: false, search: '', sort: 'name', location: { city: 'عرعر', district: 'كل الأحياء' } });
  assert.equal(client.calls.length, 1); assert.equal(client.calls[0].table, 'services');
  assert.equal(client.calls[0].events.some(event => event[0] === 'eq' && event[1] === 'district'), false);
  assert.ok(client.calls[0].events.some(event => event[0] === 'order' && event[1] === 'name' && event[2].ascending));
});
test('pagination trims the sentinel, reports more results, and propagates connection failures', async () => {
  const rows = Array.from({ length: 13 }, (_, index) => ({ id: String(index), name: 'منشأة ' + index, created_at: '2026-10-28T00:00:00Z' }));
  const result = await fetchDirectoryPage(clientFor({ businesses: rows }), { ...options, kind: 'business' });
  assert.equal(result.items.length, 12); assert.equal(result.hasMore, true);
  assert.ok(result.items.every(row => row.kind === 'business'));
  await assert.rejects(fetchDirectoryPage(clientFor({}, new Error('offline')), options), /offline/);
});
