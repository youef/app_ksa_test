'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/favorites.tsx'), 'utf8');

test('favorites uses shared visual palette and responsive layout', () => {
  assert.match(source, /colors=\{\[OASIS\.colors\.deep, OASIS\.colors\.primary/);
  assert.match(source, /maxWidth: 880/);
  assert.match(source, /paddingBottom: bottomNavInset \+ 28/);
});

test('favorites actions are accessible and refresh gives feedback', () => {
  assert.match(source, /accessibilityLabel="البحث في العناصر المحفوظة"/);
  assert.match(source, /accessibilityState=\{\{ selected: filter === f\.key \}\}/);
  assert.match(source, /refreshing \? <ActivityIndicator/);
  assert.match(source, /accessibilityLabel=\{\x60إزالة \$\{item\.title \|\| meta\.label\} من المفضلة\x60\}/);
});

test('favorites recovery and discovery links are actionable', () => {
  assert.match(source, /setQuery\(''\); setFilter\('all'\)/);
  assert.match(source, /router\.push\('\/questions'\)/);
  assert.doesNotMatch(source, /router\.push\('\/question'\)/);
});
