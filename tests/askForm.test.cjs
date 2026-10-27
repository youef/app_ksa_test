const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const filename = require.resolve('../lib/askForm.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const compiled = new Module(filename);
compiled._compile(code.outputText, filename);
const { parseAskReward, normalizeAskNumber, includesPrivateSchoolDetails } = compiled.exports;

test('rewards accept Arabic, Persian and western digits and decimal separators', () => {
  for (const input of ['٢٥٫٥٠', '۲۵٫۵۰', '25.50', '25,50']) assert.equal(parseAskReward(input), 25.5);
  assert.equal(parseAskReward('١٬٠٠٠'), 1000);
  assert.equal(parseAskReward('٠'), 0);
  assert.equal(parseAskReward('  '), null);
  assert.equal(normalizeAskNumber('٨'), '8');
});
test('invalid and negative rewards never become a valid publication amount', () => {
  for (const input of ['-٥', '1e3', 'Infinity', '٥ريال', '٢٫٥٫٠', '5.999', '.']) assert.equal(Number.isNaN(parseAskReward(input)), true, input);
});
test('school privacy validation catches Arabic phone numbers and exact meeting times', () => {
  for (const text of ['تواصل على ٠٥٥١٢٣٤٥٦٧', '05 5123 4567', '۰۵۵۱۲۳۴۵۶۷', 'نلتقي ٧:٣٠', 'عنوان المنزل قرب الحديقة']) assert.equal(includesPrivateSchoolDetails(text), true, text);
  assert.equal(includesPrivateSchoolDetails('أفضل سيارة عائلية والتنسيق برسائل حيّنا'), false);
});
