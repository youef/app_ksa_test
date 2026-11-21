const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../components/account/AccountCenter.tsx'), 'utf8');

test('settings navigation preserves grouped RTL layout', () => {
  for (const label of ['ملفي وخصوصيتي', 'التطبيق والمظهر', 'المساعدة وإدارة الحساب']) assert.ok(source.includes(label));
  assert.match(source, /settingsListItem: \{ flexDirection: 'row-reverse', minHeight: 72/);
  assert.match(source, /settingsListIcon: \{ width: 42, height: 42/);
});

test('settings descriptions wrap and navigation is screen-reader friendly', () => {
  assert.match(source, /accessibilityHint=\{item.description\}/);
  assert.match(source, /settingsListSubtitle} numberOfLines=\{2\}/);
  assert.match(source, /settingsBack: \{ alignSelf: 'flex-end', minHeight: 44/);
  assert.match(source, /accessibilityLabel="العودة إلى أقسام الإعدادات"/);
});
