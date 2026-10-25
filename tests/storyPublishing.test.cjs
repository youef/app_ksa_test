const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function load(relative, mocks, globals = {}) {
  const filename = require.resolve(relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { if (!(name in mocks)) throw Error('Unexpected import: ' + name); return mocks[name]; }, console, __DEV__: false, ...globals }, { filename });
  return module.exports;
}
test('failed image uploads never publish a local device URL as a success', async () => {
  const api = load('../lib/storyUpload.ts', { './supabase': { supabase: { storage: { from: () => ({ upload: async () => ({ error: { message: 'offline' } }) }) } } } }, { fetch: async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }) });
  await assert.rejects(api.uploadStoryImage({ uri: 'file:///private/photo.jpg', userId: 'owner', index: 0 }));
  const fallback = await api.uploadStoryImage({ uri: 'file:///private/photo.jpg', base64: 'YQ==', userId: 'owner', index: 0 });
  assert.equal(fallback.strategy, 'base64');
  assert.equal(fallback.url.startsWith('data:image/jpeg;base64,'), true);
});
test('publishing obeys account-wide disabled replies even when the composer requests replies', async () => {
  let inserted;
  const profileQuery = { select() { return this; }, eq() { return this; }, async single() { return { data: { allow_story_replies: 'nobody' }, error: null }; } };
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: table => table === 'profiles' ? profileQuery : { insert: rows => { inserted = rows; return { select: async () => ({ data: rows.map((_, i) => ({ id: 'published-' + i })), error: null }) }; } } };
  const api = load('../lib/storyPublish.ts', { './supabase': { supabase }, './storyGradients': { getGradient: () => ({ colors: ['#166044'] }) }, './storySlides': { selectPublishableSlides: rows => rows }, './storyTypes': { STORY_LIMITS: { ttlMs: 86400000 } }, './storyUpload': { uploadStoryImage: async () => { throw Error('text should not upload'); } } });
  const result = await api.publishStorySlides([{ type: 'text', content: 'يومي في الحي', bgGradId: 0 }], undefined, { audience: 'followers', allowedUserIds: [], hiddenUserIds: [], allowReplies: true, interactiveType: 'none' });
  assert.equal(result.publishedCount, 1);
  assert.equal(inserted[0].allow_replies, false);
  assert.equal(inserted[0].visibility, 'followers');
});
