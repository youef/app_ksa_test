'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const studio = fs.readFileSync(path.join(__dirname, '../components/profile/ProfileDesignStudio.tsx'), 'utf8');
const entry = fs.readFileSync(path.join(__dirname, '../components/profile/ProfileCustomizationEntry.tsx'), 'utf8');
test('studio exposes meaningful accessible labels and states', () => {
  for (const value of ['حفظ عنوان الأعمال المميزة', 'عنوان الأعمال المميزة', 'إزالة صورة الغلاف', 'استعادة إعدادات المظهر الافتراضية', 'accessibilityRole="checkbox"', 'accessibilityRole="tab"', 'accessibilityState={{ selected: active }}']) assert.ok(studio.includes(value), value);
});
test('studio cover controls and accent swatches have adequate touch targets', () => {
  assert.match(studio, /coverPrimary: \{ flex: 1, minHeight: 44,/);
  assert.match(studio, /coverSecondary: \{ minHeight: 44,/);
  assert.match(studio, /accentDot: \{ width: 44, height: 44,/);
  assert.match(entry, /minHeight: 68/);
});
test('studio preserves featured selection handlers and RTL preview', () => {
  assert.ok(studio.includes('onToggleFeatured(item.type, item.id)'));
  assert.ok(studio.includes('textAlign:\'right\',flexShrink:1'));
  assert.ok(studio.includes('TYPE_LABELS[activeType]'));
});
