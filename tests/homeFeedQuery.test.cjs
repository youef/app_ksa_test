const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const sourcePath = require.resolve('../lib/homeFeedQuery.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const sourceModule = new Module(sourcePath);
sourceModule._compile(compiled.outputText, sourcePath);
const { queryHomePosts, feedLocationPattern } = sourceModule.exports;
const scope = { city: 'عرعر', district: 'أملاك الحرس الوطني' };

function fixture(rows = [], status = 200) {
  const calls = [];
  const client = createClient('https://example.supabase.co', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
      if (status !== 200) return new Response(JSON.stringify({ message: 'denied' }), { status });
      if (url.pathname.includes('/rpc/')) return new Response(JSON.stringify(rows), { status });
      let result = [...rows];
      for (const [key, value] of url.searchParams) {
        if (value.startsWith('imatch.')) result = result.filter(row => new RegExp(value.slice(7), 'i').test(row[key] ?? ''));
        if (value.startsWith('eq.')) result = result.filter(row => row[key] === value.slice(3));
      }
      return new Response(JSON.stringify(result.slice(0, Number(url.searchParams.get('limit')))), { status });
    } },
  });
  return { client, calls };
}

test('older neighborhood posts fill the first page despite newer posts from other locations', async () => {
  const rows = Array.from({ length: 40 }, (_, n) => ({ id: `other-${n}`, city: n % 2 ? 'الرياض' : 'عرعر', district: 'الريان' }));
  rows.push({ id: 'local-1', city: 'عرعر', district: 'املاك الحرس الوطني' }, { id: 'local-2', city: 'مدينة عرعر', district: 'حي أملاك الحرس الوطني' });
  const { client, calls } = fixture(rows);
  const result = await queryHomePosts(client, 'questions', scope, 'user-1', 1);
  assert.deepEqual(result.data.map(row => row.id), ['local-1']);
  assert.equal(result.hasMore, true);
  assert.match(calls[0].url.searchParams.get('city'), /^imatch\.\^/);
  assert.match(calls[0].url.searchParams.get('district'), /^imatch\.\^/);
  assert.equal(calls[0].url.searchParams.get('limit'), '2');
  assert.equal(calls[0].url.searchParams.get('order'), 'created_at.desc,id.desc');
});

test('city-wide scope keeps all districts, but never includes another city', async () => {
  const { client, calls } = fixture([{ id: 'a', city: 'عرعر', district: 'الريان' }, { id: 'b', city: 'الرياض', district: 'الريان' }]);
  const result = await queryHomePosts(client, 'questions', { ...scope, district: 'كل الأحياء' }, 'user-1', 30);
  assert.deepEqual(result.data.map(row => row.id), ['a']);
  assert.equal(calls[0].url.searchParams.has('district'), false);
  assert.equal(result.hasMore, false);
});

test('unset city and guest own-post scopes never issue an unscoped network request', async () => {
  const { client, calls } = fixture();
  assert.equal((await queryHomePosts(client, 'questions', { city: 'كل المدن', district: 'كل الأحياء' }, 'user-1', 30)).data.length, 0);
  assert.equal((await queryHomePosts(client, 'questions', scope, null, 30, true)).data.length, 0);
  assert.equal(calls.length, 0);
});

test('my posts use the authenticated author and preserve open-request filtering', async () => {
  const { client, calls } = fixture([{ id: 'a', requester_id: 'user-1', city: 'الرياض', status: 'open' }, { id: 'b', requester_id: 'user-2', status: 'open' }, { id: 'c', requester_id: 'user-1', status: 'closed' }]);
  const result = await queryHomePosts(client, 'requests', scope, 'user-1', 30, true);
  assert.deepEqual(result.data.map(row => row.id), ['a']);
  assert.equal(calls[0].url.searchParams.get('requester_id'), 'eq.user-1');
  assert.equal(calls[0].url.searchParams.has('city'), false);
});

test('guest requests keep the existing RPC and stop at its enforced maximum', async () => {
  const { client, calls } = fixture(Array.from({ length: 100 }, (_, id) => ({ id })));
  const result = await queryHomePosts(client, 'requests', scope, null, 120);
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/hayna_guest_requests');
  assert.deepEqual(calls[0].body, { p_city: scope.city, p_district: scope.district, p_limit: 100 });
  assert.equal(result.hasMore, false);
});

test('Arabic variants match exact location names and regex characters stay literal', () => {
  const pattern = new RegExp(feedLocationPattern('حي أملاك  الحرس الوطني', 'حي'));
  assert.ok(pattern.test('  حي املاك الحرس الوطني  '));
  assert.equal(pattern.test('أملاك الحرس الوطني الشرقي'), false);
  const literal = new RegExp(feedLocationPattern('حي أ (1).*', 'حي'));
  assert.ok(literal.test('حي أ (1).*'));
  assert.equal(literal.test('حي أ 111anything'), false);
});

test('query errors are returned to the feed instead of becoming successful empty results', async () => {
  const { client } = fixture([], 403);
  const result = await queryHomePosts(client, 'questions', scope, 'user-1', 30);
  assert.ok(result.error);
  assert.equal(result.hasMore, false);
});
