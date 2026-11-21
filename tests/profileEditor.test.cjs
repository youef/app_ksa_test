const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const path = require('node:path');
const sourcePath = path.resolve(__dirname, '../lib/profileEditor.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const sourceModule = new Module(sourcePath);
sourceModule._compile(compiled.outputText, sourcePath);
const { validateProfileDraft, getProfileBioProgress } = sourceModule.exports;
const valid = { displayName: 'جار من الحي', username: 'neighbor_123', bio: 'أحب مشاركة الخبرات مع الجيران.' };

test('Arabic names and bios remain valid with a Latin handle', () => {
  assert.deepEqual(validateProfileDraft(valid), {});
});
test('blank names and malformed usernames cannot be saved', () => {
  assert.ok(validateProfileDraft({ ...valid, displayName: '   ' }).displayName);
  for (const username of ['', 'ab', 'اسم_عربي', 'a b', 'a@b', 'a/b', 'a'.repeat(31)]) {
    assert.ok(validateProfileDraft({ ...valid, username }).username, username);
  }
});
test('field limits accept boundaries and reject overlong values', () => {
  assert.deepEqual(validateProfileDraft({ displayName: 'ع'.repeat(50), username: 'a'.repeat(30), bio: 'ب'.repeat(160) }), {});
  assert.ok(validateProfileDraft({ ...valid, displayName: 'ع'.repeat(51) }).displayName);
  assert.ok(validateProfileDraft({ ...valid, bio: 'ب'.repeat(161) }).bio);
});
test('Unicode names are counted as characters and input is not mutated', () => {
  const draft = { displayName: '🌿'.repeat(30), username: ' Neighbor_1 ', bio: '  نبذة  ' };
  const snapshot = { ...draft };
  assert.deepEqual(validateProfileDraft(draft), {});
  assert.deepEqual(draft, snapshot);
});

test('bio progress counts Unicode code points and clamps its visual range', () => {
  assert.deepEqual(getProfileBioProgress(''), { count: 0, percent: 0, remaining: 160, nearLimit: false });
  assert.deepEqual(getProfileBioProgress('🌿'.repeat(80)), { count: 80, percent: 50, remaining: 80, nearLimit: false });
  assert.deepEqual(getProfileBioProgress('ب'.repeat(143)), { count: 143, percent: 89, remaining: 17, nearLimit: false });
  assert.deepEqual(getProfileBioProgress('ب'.repeat(144)), { count: 144, percent: 90, remaining: 16, nearLimit: true });
  assert.deepEqual(getProfileBioProgress('ب'.repeat(170)), { count: 170, percent: 100, remaining: 0, nearLimit: true });
});
