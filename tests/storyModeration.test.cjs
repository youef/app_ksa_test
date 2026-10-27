const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const filename = require.resolve('../lib/storyModeration.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const compiled = new Module(filename);
compiled._compile(source.outputText, filename);
const { findProhibitedStoryWord: find } = compiled.exports;

test('checks captions, poll questions, every poll option and question prompts', () => {
  for (const row of [{ content: 'blocked' }, { poll_question: 'blocked' }, { poll_options: ['clean', 'blocked'] }, { question_prompt: 'blocked' }]) {
    assert.equal(find(row, ['blocked']), 'blocked');
  }
});
test('catches punctuation, separated letters, invisible characters and mixed case', () => {
  for (const content of ['BLoCkEd', 'b.l.o.c.k.e.d', 'b l o c k e d', 'b\u200Dl\u200Co\u200Bc\u2060k\uFEFFed']) {
    assert.equal(find({ content }, ['blocked']), 'blocked');
  }
});
test('normalizes Arabic diacritics, elongation and letter variants', () => {
  assert.equal(find({ content: 'كَلِـمَة مَمنُوعَة' }, ['كلمة ممنوعة']), 'كلمة ممنوعة');
  assert.equal(find({ content: 'إِسَاءَة' }, ['اساءة']), 'اساءة');
  assert.equal(find({ content: 'لفظ' }, ['لفظ']), 'لفظ');
});
test('matches whole words and supports two-letter entries without rejecting harmless substrings', () => {
  assert.equal(find({ content: 'عكس السير classic classroom' }, ['كس', 'ass']), null);
  assert.equal(find({ content: 'نص xy آخر' }, ['xy']), 'xy');
  assert.equal(find({ content: 'text' }, ['t', '']), null);
});
test('handles empty or malformed optional text fields', () => {
  assert.equal(find({ content: null, poll_question: 42, poll_options: { bad: 'blocked' } }, ['blocked']), null);
  assert.equal(find({ content: 'clean' }, []), null);
});
