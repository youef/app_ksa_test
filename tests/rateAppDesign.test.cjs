'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../app/rate-app.tsx'), 'utf8');

test('rating screen derives palette and surfaces from OASIS theme', () => {
  assert.ok(source.includes("import { useTheme, type OasisColors } from '@/lib/oasis';"));
  assert.ok(source.includes('useMemo(() => createStyles(colors, isDark), [colors, isDark])'));
  assert.ok(source.includes('colors.live, colors.deep'));
  assert.ok(source.includes('colors.warningSoft'));
  assert.ok(source.includes('colors.surface'));
  assert.ok(!source.includes('#F4F7FB'));
  assert.ok(!source.includes('#B45309'));
  assert.ok(!source.includes('#CBD5E1'));
});

test('layout centers the content and accounts for safe area and bottom dock', () => {
  assert.ok(source.includes('maxWidth: 640'));
  assert.ok(source.includes("width: '100%'"));
  assert.ok(source.includes('paddingHorizontal: 16'));
  assert.ok(source.includes('useSafeAreaInsets()'));
  assert.ok(source.includes('Math.max(bottomNavInset + 16, safeAreaInsets.bottom + 92)'));
  assert.ok(source.includes('keyboardShouldPersistTaps="handled"'));
});

test('star controls have accessible names, selection state and minimum touch size', () => {
  assert.ok(source.includes('minWidth: 44, minHeight: 44'));
  assert.ok(source.includes('accessibilityLabel={\\'تقييم \\' + ' + n + ' + \\' من 5\\'}'));
  assert.ok(source.includes('accessibilityState={{ selected: n === rating }}'));
  assert.ok(source.includes('size={28}'));
});

test('feedback reasons expose checked state and a comfortable RTL touch surface', () => {
  assert.ok(source.includes('accessibilityRole="checkbox"'));
  assert.ok(source.includes('accessibilityState={{ checked: selected }}'));
  assert.ok(source.includes('accessibilityHint="اختيار أو إلغاء هذا المحور"'));
  assert.ok(source.includes('minHeight: 44'));
  assert.ok(source.includes('reasonChipActive'));
});

test('feedback field is labeled, multiline and announces its character count', () => {
  assert.ok(source.includes('const REVIEW_LIMIT = 1500'));
  assert.ok(source.includes('accessibilityLabel="ملاحظاتك واقتراحاتك"'));
  assert.ok(source.includes('accessibilityHint="حقل اختياري متعدد الأسطر، حتى 1500 حرف"'));
  assert.ok(source.includes('maxLength={REVIEW_LIMIT}'));
  assert.ok(source.includes('accessibilityLiveRegion="polite"'));
  assert.ok(source.includes('body.length} / {REVIEW_LIMIT'));
});

test('loading failures have an in-screen retry state without altering submission contract', () => {
  assert.ok(source.includes('loadError'));
  assert.ok(source.includes('تعذّر تحميل تقييمك السابق'));
  assert.ok(source.includes('onPress={() => void load()}'));
  assert.ok(source.includes('accessibilityLabel="إعادة تحميل التقييم"'));
  assert.ok(source.includes("from('app_reviews').upsert"));
  assert.ok(source.includes("onConflict: 'user_id'"));
  assert.ok(source.includes('accessibilityState={{ disabled: saving, busy: saving }}'));
});
