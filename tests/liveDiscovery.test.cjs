const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/liveDiscovery.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: moduleObject.exports, module: moduleObject });
const { discoverLives } = moduleObject.exports;
const streams = [
  { id: 'old', title: 'أخبار الحَيّ', category: 'مجتمع', host_id: 'a', viewer_count: 30, started_at: '2026-10-25T10:00:00Z', profiles: { username: 'hayna', display_name: 'فريق حينا', city: 'الرياض' } },
  { id: 'new', title: 'لقاء الجيران', category: 'مجتمع', host_id: 'b', viewer_count: 2, started_at: '2026-10-25T11:00:00Z', profiles: { username: 'neighbor', display_name: 'جار', city: 'جدة' } },
];
test('Arabic search matches normalized words across title and city', () => {
  assert.equal(discoverLives(streams, 'اخبار الحي الرياض', 'popular')[0]?.id, 'old');
  assert.equal(discoverLives(streams, '@neighbor', 'newest')[0]?.id, 'new');
  assert.equal(discoverLives(streams, 'غير موجود', 'popular').length, 0);
});
test('popular/newest sorting never mutates the source and includes a single stream', () => {
  assert.equal(discoverLives(streams, '', 'popular')[0].id, 'old');
  assert.equal(discoverLives(streams, '', 'newest')[0].id, 'new');
  assert.equal(streams[0].id, 'old');
  assert.equal(discoverLives([streams[0]], '', 'popular').length, 1);
});
