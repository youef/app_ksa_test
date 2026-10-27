const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const filename = require.resolve('../lib/pageBackgrounds.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const compiled = new Module(filename);
compiled._compile(output.outputText, filename);
const { parsePageBackgrounds, DEFAULT_PAGE_BACKGROUNDS, isBackgroundPath, detectBackgroundImage } = compiled.exports;

test('missing configuration preserves the existing three independent backgrounds', () => {
  assert.deepEqual(parsePageBackgrounds(null), DEFAULT_PAGE_BACKGROUNDS);
  const parsed = parsePageBackgrounds({ app: { path: 'backgrounds/my-image.webp', lightOpacity: .45, darkOpacity: .2 } });
  assert.equal(parsed.app.path, 'backgrounds/my-image.webp');
  assert.equal(parsed.app.lightOpacity, .45);
  assert.deepEqual(parsed.welcome, DEFAULT_PAGE_BACKGROUNDS.welcome);
  assert.deepEqual(parsed.login, DEFAULT_PAGE_BACKGROUNDS.login);
});
test('untrusted URLs, SVGs and traversal paths never become a page image', () => {
  for (const path of ['https://example.com/a.png','data:image/svg+xml,evil','backgrounds/../global/logo.png','global/logo.png','backgrounds/a.svg','backgrounds/a.png?anything','backgrounds/a/b.png']) {
    assert.equal(isBackgroundPath(path), false, path);
    assert.equal(parsePageBackgrounds({ app: { path } }).app.path, null);
  }
});
test('invalid opacity values fall back without blanking the page', () => {
  for (const bad of [null, NaN, Infinity, -1, 0, 1.1, '0.5']) {
    const parsed = parsePageBackgrounds({ app: { lightOpacity: bad, darkOpacity: bad } });
    assert.equal(parsed.app.lightOpacity, .27);
    assert.equal(parsed.app.darkOpacity, .16);
  }
});
test('image signatures identify each supported format instead of trusting extensions', () => {
  const fixtures = [
    [[137,80,78,71,13,10,26,10], 'image/png'],
    [[255,216,255,224], 'image/jpeg'],
    [[71,73,70,56,57,97], 'image/gif'],
    [[82,73,70,70,0,0,0,0,87,69,66,80], 'image/webp'],
  ];
  for (const [bytes,mime] of fixtures) assert.equal(detectBackgroundImage(new Uint8Array(bytes)).mime, mime);
  assert.equal(detectBackgroundImage(new Uint8Array(Buffer.from('<svg>not a bitmap</svg>'))), null);
  assert.equal(detectBackgroundImage(new Uint8Array()), null);
});
