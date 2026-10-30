const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

const functionDir = path.resolve(__dirname, '../supabase/functions/delete-account');
function compile(filename) {
  return ts.transpileModule(fs.readFileSync(path.join(functionDir, filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const storageModule = { exports: {} };
vm.runInNewContext(compile('storageBuckets.ts'), {
  module: storageModule, exports: storageModule.exports,
});
const { ACCOUNT_MEDIA_BUCKETS, accountMediaPrefixes } = storageModule.exports;

test('account deletion includes all user-private media buckets, never nonexistent or shared buckets', () => {
  assert.deepEqual(Array.from(ACCOUNT_MEDIA_BUCKETS).sort(), [
    'avatars', 'chat-media', 'question-media', 'service-images', 'story-media',
    'verification-documents',
  ].sort());
  assert.equal(ACCOUNT_MEDIA_BUCKETS.includes('stories'), false);
  assert.equal(ACCOUNT_MEDIA_BUCKETS.includes('home-announcements'), false);
  assert.deepEqual(Array.from(accountMediaPrefixes('avatars', 'account-id')), [
    'account-id', 'story_account-id',
  ]);
  assert.deepEqual(Array.from(accountMediaPrefixes('story-media', 'account-id')), ['account-id']);
});

function harness(failureBucket) {
  const calls = [];
  let handler;
  const userId = 'test-account-id';
  const authClient = { auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) } };
  const admin = {
    storage: { from(bucket) {
      return {
        async list(prefix) {
          calls.push(['list', bucket, prefix]);
          if (bucket === failureBucket) return { data: null, error: new Error('simulated storage failure') };
          if (bucket === 'story-media' && prefix === userId) {
            return { data: [{ id: 'image-id', name: 'story.webp' }], error: null };
          }
          return { data: [], error: null };
        },
        async remove(paths) { calls.push(['remove', bucket, ...paths]); return { error: null }; },
      };
    } },
    auth: { admin: { async deleteUser(id) { calls.push(['deleteUser', id]); return { error: null }; } } },
  };
  let clientNumber = 0;
  const createClient = () => ++clientNumber === 1 ? authClient : admin;
  const dependencies = (name) => {
    if (name.includes('/http/server.ts')) return { serve: callback => { handler = callback; } };
    if (name.includes('@supabase/supabase-js')) return { createClient };
    if (name === './storageBuckets.ts') return storageModule.exports;
    throw new Error('Unexpected import: ' + name);
  };
  vm.runInNewContext(compile('index.ts'), {
    require: dependencies,
    exports: {},
    Response,
    console: { error() {} },
    Deno: { env: { get: name => ({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service',
    })[name] } },
  });
  assert.equal(typeof handler, 'function');
  return {
    calls,
    invoke: () => handler({
      method: 'POST',
      headers: { get: name => name === 'Authorization' ? 'Bearer test-token' : null },
    }),
  };
}

test('removes account-scoped story objects before deleting the authenticated user', async () => {
  const { calls, invoke } = harness();
  const response = await invoke();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.ok(calls.some(call => call[0] === 'remove' && call[1] === 'story-media'
    && call[2] === 'test-account-id/story.webp'));
  assert.equal(calls.filter(call => call[0] === 'list').length, ACCOUNT_MEDIA_BUCKETS.length + 1);
  assert.deepEqual(calls.at(-1), ['deleteUser', 'test-account-id']);
});

test('aborts account deletion if storage cleanup fails, rather than reporting success', async () => {
  const { calls, invoke } = harness('verification-documents');
  const response = await invoke();
  assert.equal(response.status, 500);
  assert.equal(calls.some(call => call[0] === 'deleteUser'), false);
});
