const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../components/market/BusinessSettingsSheet.tsx'), 'utf8');
test('business settings groups form content in Arabic', () => {
  for (const label of ['الهوية والوصف', 'الموقع', 'وسائل التواصل']) assert.ok(source.includes(label));
});
test('image actions are accessible with 44px targets', () => {
  assert.match(source, /mediaAction: \{ minHeight: 44/);
  assert.match(source, /اختيار شعار المنشأة/);
  assert.match(source, /اختيار صورة غلاف المنشأة/);
});
test('sheet accommodates safe area and keyboard', () => {
  assert.match(source, /useSafeAreaInsets/);
  assert.match(source, /Math.max\(insets.bottom, 16\)/);
  assert.match(source, /keyboardDismissMode="on-drag"/);
});
