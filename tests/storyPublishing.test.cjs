const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript'), fs = require('node:fs'), vm = require('node:vm');
function load(relative, mocks, globals = {}) {
  const filename = require.resolve(relative), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { if (!(name in mocks)) throw Error('Unexpected import: ' + name); return mocks[name]; }, console, __DEV__: false, ...globals }, { filename });
  return module.exports;
}
test('failed resumable image uploads never publish local or inline data URLs as success', async () => {
  let attempts = 0;
  const api = load('../lib/storyUpload.ts', {
    './storyTus': { uploadResumableStory: async () => { attempts++; throw Error('offline'); } },
    'react-native': { Platform: { OS: 'android' }, Image: { getSize: (_uri, resolve) => resolve(640, 480) } },
    './supabase': { supabase: { storage: { from: () => ({ getPublicUrl: () => assert.fail('failed upload cannot return a public URL') }) } } }
  }, { Blob, fetch: async () => ({ ok: true, blob: async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], { type: 'image/jpeg' }) }) });
  await assert.rejects(api.uploadStoryImage({ uri: 'file:///private/photo.jpg', userId: 'owner', index: 0 }), /offline/);
  await assert.rejects(api.uploadStoryImage({ uri: 'file:///private/photo.jpg', base64: 'YQ==', userId: 'owner', index: 0 }), /offline/);
  assert.equal(attempts, 2);
});
function publisherWithResults(results, { replies = 'everyone', recent = [] } = {}) {
  const calls = { inserts: 0, uploads: 0 };
  const recentQuery = { eq() { return this; }, order() { return this; }, async limit() { return { data: recent, error: null }; } };
  const profile = { select() { return this; }, eq() { return this; }, async single() { return { data: { allow_story_replies: replies }, error: null }; } };
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    from: table => table === 'profiles' ? profile : {
      select: () => recentQuery,
      insert: rows => ({ select: async () => { calls.inserts++; calls.rows = rows; assert.ok(results.length, 'Unexpected duplicate insert'); return results.shift(); } })
    }
  };
  const api = load('../lib/storyPublish.ts', {
    './supabase': { supabase }, './storyGradients': { getGradient: () => ({ colors: ['#166044'] }) },
    './storySlides': { selectPublishableSlides: rows => rows }, './storyTypes': { STORY_LIMITS: { ttlMs: 86400000 } },
    './storyUpload': { uploadStoryImage: async () => { calls.uploads++; throw Error('text should not upload'); } }
  });
  return { api, calls };
}
const slide = { type: 'text', content: 'يومي في الحي', bgGradId: 0 };
test('account-wide disabled replies override the composer and preserve the chosen audience', async () => {
  const { api, calls } = publisherWithResults([{ data: [{ id: 'published' }], error: null }], { replies: 'nobody' });
  const result = await api.publishStorySlides([slide], undefined, { audience: 'followers', allowedUserIds: [], hiddenUserIds: [], allowReplies: true, interactiveType: 'none' });
  assert.equal(result.publishedCount, 1); assert.equal(calls.rows[0].allow_replies, false); assert.equal(calls.rows[0].visibility, 'followers');
});
test('a silently blocked insert never reports a published story', async () => {
  const { api, calls } = publisherWithResults([{ data: [], error: null }]);
  const result = await api.publishStorySlides([slide]);
  assert.equal(result.publishedCount, 0); assert.equal(result.firstPublishedId, undefined); assert.equal(result.failures.length, 1); assert.equal(calls.inserts, 1);
});
test('only one story per publishing window is accepted before uploads or inserts', async () => {
  const { api, calls } = publisherWithResults([]);
  const result = await api.publishStorySlides([slide, { ...slide, content: 'شريحة أخرى' }]);
  assert.equal(result.publishedCount, 0); assert.equal(result.requestedCount, 2); assert.equal(calls.inserts, 0); assert.equal(calls.uploads, 0);
});
test('an insert failure never retries a removed upload or reports success', async () => {
  const { api, calls } = publisherWithResults([{ data: null, error: { message: 'batch rejected' } }]);
  const result = await api.publishStorySlides([slide]);
  assert.equal(result.publishedCount, 0); assert.equal(result.firstPublishedId, undefined); assert.equal(calls.inserts, 1); assert.match(result.failures[0], /batch rejected/);
});
test('recent stories enforce the three-hour cooldown before a write', async () => {
  const { api, calls } = publisherWithResults([], { recent: [{ created_at: new Date(Date.now() - 60000).toISOString() }] });
  const result = await api.publishStorySlides([slide]);
  assert.equal(result.publishedCount, 0); assert.equal(calls.inserts, 0); assert.equal(calls.uploads, 0);
});
test('an expired publishing window permits one server-confirmed story', async () => {
  const { api } = publisherWithResults([{ data: [{ id: 'confirmed' }], error: null }], { recent: [{ created_at: new Date(Date.now() - 10801000).toISOString() }] });
  const result = await api.publishStorySlides([slide]);
  assert.equal(result.publishedCount, 1); assert.equal(result.firstPublishedId, 'confirmed');
});
