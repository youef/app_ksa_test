'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/user.tsx'), 'utf8');

test('profile activity tabs are labelled with item counts', () => {
  assert.match(source, /accessibilityRole="tablist" accessibilityLabel="تصفية نشاط الملف الشخصي"/);
  assert.match(source, /accessibilityLabel=\{\x60\$\{label\}، \$\{count\} عنصر\x60\}/);
  assert.match(source, /accessibilityState=\{\{selected: active\}\}/);
});

test('profile activity recovery and navigation are accessible', () => {
  assert.match(source, /accessibilityLabel="إعادة تحميل نشاط الملف الشخصي"/);
  assert.match(source, /accessibilityLabel="الانتقال إلى سوق الحي"/);
  assert.match(source, /accessibilityLiveRegion="polite"/);
});

test('activity layout adapts for long Arabic headings', () => {
  assert.match(source, /contentHead: \{[^\n]*flexWrap: 'wrap'/);
  assert.match(source, /marketLink: \{[^\n]*minHeight: 44/);
});
