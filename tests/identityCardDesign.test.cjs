const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../components/profile/ProfileIdentityCard.tsx'), 'utf8');

test('identity options announce selected state and wrap Arabic labels', () => {
  assert.match(source, /accessibilityState=\{\{ selected: active \}\}/);
  assert.match(source, /numberOfLines=\{2\}/);
  assert.match(source, /flexBasis: '42%'/);
});

test('identity controls meet minimum touch heights', () => {
  assert.match(source, /typeOption: \{[\s\S]*?minHeight: 52/);
  assert.match(source, /manageButton: \{\s*minHeight: 48/);
  assert.match(source, /statusBox: \{\s*minHeight: 48/);
});

test('identity action contracts are unchanged', () => {
  assert.match(source, /onSelectType\?\.\(type\)/);
  assert.match(source, /onPress=\{onManage\}/);
});
