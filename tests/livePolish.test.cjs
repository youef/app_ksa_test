'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '../app', file), 'utf8');

test('live creation guides users through three accessible sections', () => {
  const source = read('live/create.tsx');
  for (const step of ['١ / ٣', '٢ / ٣', '٣ / ٣']) assert.ok(source.includes(step));
  assert.match(source, /accessibilityRole="radio" accessibilityState=\{\{ checked: audience === item\.key \}\}/);
  assert.match(source, /accessibilityState=\{\{ selected: category === item \}\}/);
});

test('room actions retain meaningful accessibility labels', () => {
  const source = read('live/[id].tsx');
  for (const label of ['إنهاء البث المباشر', 'إظهار أدوات البث والتعليقات', 'إرسال التعليق', 'اكتب تعليقًا في البث']) assert.ok(source.includes(label));
});

test('directory filters expose selection and refresh without blanking results', () => {
  const source = read('lives.tsx');
  assert.match(source, /onRefresh=\{reload\}/);
  assert.match(source, /accessibilityLabel=\{\x60عرض \$\{label\}، \$\{baseCounts\[key\]\} بث\x60\}/);
  assert.match(source, /accessibilityState=\{\{ selected: filter === key \}\}/);
});
