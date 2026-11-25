'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screen = fs.readFileSync(path.join(__dirname, '../app/report.tsx'), 'utf8');

test('report form establishes a calm, responsive hierarchy and respects the bottom dock', () => {
  assert.ok(screen.includes('ساعدنا نحافظ على حيّنا'));
  assert.ok(screen.includes('accessibilityRole="header"'));
  assert.ok(screen.includes('maxWidth: 760'));
  assert.ok(screen.includes('borderRadius: 22'));
  assert.ok(screen.includes('useBottomNavInset(24)'));
  assert.ok(screen.includes('paddingBottom: bottomNavInset'));
  assert.ok(screen.includes('keyboardDismissMode="on-drag"'));
});

test('report reasons are accessible radio choices with comfortable touch targets', () => {
  assert.ok(screen.includes('accessibilityRole="radio"'));
  assert.ok(screen.includes('accessibilityState={{ checked: selected }}'));
  assert.ok(screen.includes('minHeight: 56'));
  assert.ok(screen.includes('reasonOptionWide'));
  assert.ok(screen.includes('accessibilityHint="اختر هذا السبب لتوضيح طبيعة البلاغ"'));
});

test('optional details field is labeled and spacious for multiline input', () => {
  assert.ok(screen.includes('accessibilityLabel="تفاصيل إضافية للبلاغ"'));
  assert.ok(screen.includes('accessibilityHint="حقل اختياري متعدد الأسطر"'));
  assert.ok(screen.includes('multiline'));
  assert.ok(screen.includes('minHeight: 136'));
  assert.ok(screen.includes('textAlignVertical="top"'));
});

test('submit action announces its busy state and renders an inline recoverable error', () => {
  assert.ok(screen.includes('minHeight: 52'));
  assert.ok(screen.includes('accessibilityState={{ disabled: submitting, busy: submitting }}'));
  assert.ok(screen.includes('disabled={submitting}'));
  assert.ok(screen.includes('accessibilityLiveRegion="assertive"'));
  assert.ok(screen.includes('submitError'));
  assert.ok(screen.includes('finally {\n      setSubmitting(false);'));
});

test('private report history has loading, retry, signed-out, empty and populated states', () => {
  assert.ok(screen.includes('reportsLoading'));
  assert.ok(screen.includes('reportsError'));
  assert.ok(screen.includes('historySignedIn === false'));
  assert.ok(screen.includes('myReports.length === 0'));
  assert.ok(screen.includes('onPress={() => void loadMyReports()}'));
  assert.ok(screen.includes('.limit(6)'));
});

test('report submission keeps the existing reports table and payload contract', () => {
  assert.ok(screen.includes("from('reports').insert"));
  assert.ok(screen.includes('reporter_id: userData.user.id'));
  assert.ok(screen.includes("target_type: type || 'unknown'"));
  assert.ok(screen.includes('target_id: id'));
  assert.ok(screen.includes('reason: fullReason'));
  assert.ok(screen.includes("router.replace('/auth')"));
  assert.ok(screen.includes('router.back()'));
});
