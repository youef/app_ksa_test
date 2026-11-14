'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/directory.tsx'), 'utf8');

test('directory controls expose accessible labels and selection', () => {
  for (const label of ['عرض ${title} في الدليل', 'عرض المنشآت والخدمات الموثّقة فقط', 'إعادة ضبط البحث والفلاتر والترتيب', 'إعادة تحميل نتائج الدليل', 'عرض المزيد من نتائج الدليل']) assert.ok(source.includes(label), label);
  assert.match(source, /accessibilityState=\{\{ selected: kind === value \}\}/);
});
test('directory reset also covers sort-only changes and pending query', () => {
  assert.ok(source.includes("query || search || kind !== 'all' || verified || sort !== 'recent'"));
});
test('directory touch targets and card sizing are phone-friendly', () => {
  assert.match(source, /clear: \{ width: 44, height: 44/);
  assert.match(source, /chip: \{[^\n]*minHeight: 44/);
  assert.match(source, /resetButton: \{ minHeight: 44, minWidth: 44/);
  assert.match(source, /card: \{[^\n]*minHeight: 112/);
});
test('directory retains responsive layout and bottom navigation safe inset', () => {
  assert.ok(source.includes('maxWidth: 820'));
  assert.ok(source.includes('paddingBottom: bottom'));
  assert.ok(source.includes("flexDirection: 'row-reverse'"));
});
