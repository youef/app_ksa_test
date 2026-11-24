const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../components/market/BusinessDetailsSheet.tsx'), 'utf8');

test('opening-hours partial failure exposes a visible retry action', () => {
  assert.match(source, /hoursError\?[\s\S]*?errorRecoveryRow[\s\S]*?retryAction\('إعادة تحميل أوقات العمل'\)/);
});

test('offers partial failure exposes a visible retry action', () => {
  assert.match(source, /offersError\?[\s\S]*?errorRecoveryRow[\s\S]*?retryAction\('إعادة تحميل العروض والخدمات'\)/);
});

test('details failure uses the same labelled recovery control', () => {
  assert.match(source, /retryAction\('إعادة تحميل بيانات المنشأة'\)/);
});

test('retry controls announce button, label and busy state to assistive technology', () => {
  assert.match(source, /accessibilityRole="button" accessibilityLabel=\{label\}/);
  assert.match(source, /accessibilityState=\{\{disabled:loading,busy:loading\}\}/);
});

test('retry target remains at least 44 points high and has a visible label', () => {
  assert.match(source, /sectionRetry:\{minHeight:44/);
  assert.match(source, /إعادة المحاولة/);
});

test('retry requests a fresh sheet read without changing the underlying data actions', () => {
  assert.match(source, /onPress=\{\(\)=>setRetry\(value=>value\+1\)\}/);
  assert.match(source, /\[business\.id, retry\]/);
  assert.match(source, /router\.push\(\{pathname:'\/business',params:\{id:business\.id\}\}\)/);
});
