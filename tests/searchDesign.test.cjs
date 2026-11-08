'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../app/search.tsx'), 'utf8');

test('search field and clear action are accessible', () => {
  assert.match(src, /accessibilityLabel="ابحث في حيّنا/);
  assert.match(src, /accessibilityLabel="مسح نص البحث"/);
  assert.match(src, /clearBtn: \{\s*width: 44,\s*height: 44/);
});
test('search categories and city scope communicate selection', () => {
  for (const key of ['all', 'users', 'questions', 'requests', 'shops']) {
    assert.ok(src.includes("accessibilityState={{ selected: activeTab === '" + key + "' }}"));
  }
  assert.match(src, /accessibilityState=\{\{ selected: localOnly \}\}/);
  assert.match(src, /cityFilterSelected/);
});
test('empty state offers category recovery and loading announces progress', () => {
  assert.match(src, /activeTab !== 'all' && <Pressable/);
  assert.match(src, /accessibilityLabel="عرض نتائج كل الأقسام"/);
  assert.match(src, /accessibilityLiveRegion="polite"/);
});
